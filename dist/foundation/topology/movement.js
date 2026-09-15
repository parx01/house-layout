import { coordinateUm } from "../core/units.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { getConnectedWallIds, getWallOrientation, } from "./model.js";
import { validateTopologyV2 } from "./validation.js";
export class TopologyMoveError extends Error {
    stage;
    constructor(stage, message, options) {
        super(message, options);
        this.stage = stage;
        this.name = "TopologyMoveError";
    }
}
/**
 * Moves the maximal collinear run containing `wallIdentity` perpendicular to
 * that run. Shared nodes move with it and perpendicular incident walls resize.
 */
export function moveWallPerpendicular(topologyValue, wallIdentity, offsetUmValue) {
    const topology = validateInputTopology(topologyValue);
    const wall = topology.walls[wallIdentity];
    if (!wall)
        throw inputError(`Topology wall ${wallIdentity} does not exist.`);
    const offsetUm = exactCoordinate(offsetUmValue, "Wall movement offsetUm");
    const orientation = getWallOrientation(topology, wallIdentity);
    const runNodeIds = collectAxisComponentNodes(topology, wall.startNodeId, orientation);
    const planned = new Map();
    for (const nodeIdentity of runNodeIds) {
        const node = topology.nodes[nodeIdentity];
        planned.set(nodeIdentity, orientation === "horizontal"
            ? { xUm: node.xUm, yUm: safeAdd(node.yUm, offsetUm, `Wall movement at node ${node.id}`) }
            : { xUm: safeAdd(node.xUm, offsetUm, `Wall movement at node ${node.id}`), yUm: node.yUm });
    }
    const wallRunIds = Object.values(topology.walls)
        .filter((candidate) => getWallOrientation(topology, candidate.id) === orientation &&
        runNodeIds.has(candidate.startNodeId) &&
        runNodeIds.has(candidate.endNodeId))
        .map((candidate) => candidate.id)
        .sort();
    return finalizeMove(topology, planned, (base) => ({
        ...base,
        kind: "wallPerpendicular",
        wallId: wallIdentity,
        orientation,
        offsetUm,
        wallRunIds,
    }));
}
/**
 * Moves a canonical junction while propagating only the coordinate constraints
 * required to keep every incident and continued wall orthogonal.
 */
export function moveJunction(topologyValue, nodeIdentity, targetValue) {
    const topology = validateInputTopology(topologyValue);
    const node = topology.nodes[nodeIdentity];
    if (!node)
        throw inputError(`Topology node ${nodeIdentity} does not exist.`);
    const target = exactPoint(targetValue, "Junction target");
    const deltaXUm = safeSubtract(target.xUm, node.xUm, "Junction X movement");
    const deltaYUm = safeSubtract(target.yUm, node.yUm, "Junction Y movement");
    const xConstraintNodeIds = collectAxisComponentNodes(topology, nodeIdentity, "vertical");
    const yConstraintNodeIds = collectAxisComponentNodes(topology, nodeIdentity, "horizontal");
    const planned = new Map();
    for (const constrainedNodeId of xConstraintNodeIds) {
        const constrained = topology.nodes[constrainedNodeId];
        planned.set(constrainedNodeId, {
            xUm: safeAdd(constrained.xUm, deltaXUm, `Junction X movement at node ${constrained.id}`),
            yUm: constrained.yUm,
        });
    }
    for (const constrainedNodeId of yConstraintNodeIds) {
        const constrained = topology.nodes[constrainedNodeId];
        const existing = planned.get(constrainedNodeId);
        planned.set(constrainedNodeId, {
            xUm: existing?.xUm ?? constrained.xUm,
            yUm: safeAdd(constrained.yUm, deltaYUm, `Junction Y movement at node ${constrained.id}`),
        });
    }
    return finalizeMove(topology, planned, (base) => ({
        ...base,
        kind: "junction",
        nodeId: nodeIdentity,
        target,
        deltaXUm,
        deltaYUm,
        xConstraintNodeIds: [...xConstraintNodeIds].sort(),
        yConstraintNodeIds: [...yConstraintNodeIds].sort(),
    }));
}
function finalizeMove(topology, planned, metadata) {
    let beforeFaces;
    try {
        beforeFaces = extractBoundedFaces(topology);
    }
    catch (error) {
        throw inputError(`Input topology faces are not movable: ${errorMessage(error)}`, error);
    }
    const candidate = canonicalMutableClone(topology);
    const nodeChanges = [];
    for (const nodeIdentity of [...planned.keys()].sort()) {
        const before = topology.nodes[nodeIdentity];
        const after = planned.get(nodeIdentity);
        if (before.xUm === after.xUm && before.yUm === after.yUm)
            continue;
        candidate.nodes[nodeIdentity] = { id: before.id, xUm: after.xUm, yUm: after.yUm };
        nodeChanges.push({
            nodeId: nodeIdentity,
            before: { xUm: before.xUm, yUm: before.yUm },
            after: { xUm: after.xUm, yUm: after.yUm },
        });
    }
    let committed;
    try {
        committed = validateTopologyV2(candidate, "candidateTopology");
    }
    catch (error) {
        throw candidateError("candidateTopology", error);
    }
    let afterFaces;
    try {
        afterFaces = extractBoundedFaces(committed);
    }
    catch (error) {
        throw candidateError("candidateFaces", error);
    }
    const beforeFaceIds = beforeFaces.faces.map((face) => face.id);
    const afterFaceIds = afterFaces.faces.map((face) => face.id);
    if (beforeFaceIds.length !== afterFaceIds.length) {
        throw new TopologyMoveError("facePreservation", `Topology move rejected: bounded-face count would change from ${beforeFaceIds.length} to ${afterFaceIds.length}.`);
    }
    if (beforeFaceIds.some((identity, index) => identity !== afterFaceIds[index])) {
        throw new TopologyMoveError("facePreservation", "Topology move rejected: a bounded face would collapse, invert, or change its canonical boundary.");
    }
    const changedNodeIds = new Set(nodeChanges.map((change) => change.nodeId));
    const affectedWallIds = Object.values(topology.walls)
        .filter((wall) => changedNodeIds.has(wall.startNodeId) || changedNodeIds.has(wall.endNodeId))
        .map((wall) => wall.id)
        .sort();
    const translatedWallIds = [];
    const resizedWallIds = [];
    for (const wallIdentity of affectedWallIds) {
        const wall = topology.walls[wallIdentity];
        const startDisplacement = displacement(topology.nodes[wall.startNodeId], committed.nodes[wall.startNodeId]);
        const endDisplacement = displacement(topology.nodes[wall.endNodeId], committed.nodes[wall.endNodeId]);
        if (startDisplacement.xUm === endDisplacement.xUm && startDisplacement.yUm === endDisplacement.yUm) {
            translatedWallIds.push(wallIdentity);
        }
        else {
            resizedWallIds.push(wallIdentity);
        }
    }
    const beforeAreas = new Map(beforeFaces.faces.map((face) => [face.id, face.areaUm2]));
    const faceAreaChanges = afterFaces.faces
        .filter((face) => beforeAreas.get(face.id) !== face.areaUm2)
        .map((face) => ({
        faceId: face.id,
        beforeAreaUm2: beforeAreas.get(face.id),
        afterAreaUm2: face.areaUm2,
    }));
    const base = {
        nodeChanges,
        affectedWallIds,
        translatedWallIds,
        resizedWallIds,
        preservedFaceIds: beforeFaceIds,
        faceCountBefore: beforeFaceIds.length,
        faceCountAfter: afterFaceIds.length,
        faceAreaChanges,
    };
    return { topology: committed, metadata: metadata(base) };
}
function collectAxisComponentNodes(topology, startNodeId, orientation) {
    const result = new Set([startNodeId]);
    const pending = [startNodeId];
    while (pending.length) {
        const current = pending.shift();
        const wallIds = getConnectedWallIds(topology, current).sort();
        for (const wallIdentity of wallIds) {
            if (getWallOrientation(topology, wallIdentity) !== orientation)
                continue;
            const wall = topology.walls[wallIdentity];
            const other = wall.startNodeId === current ? wall.endNodeId : wall.startNodeId;
            if (result.has(other))
                continue;
            result.add(other);
            pending.push(other);
        }
    }
    return result;
}
function canonicalMutableClone(topology) {
    const nodes = Object.fromEntries(Object.keys(topology.nodes).sort().map((identity) => {
        const node = topology.nodes[identity];
        return [identity, { ...node }];
    }));
    const walls = Object.fromEntries(Object.keys(topology.walls).sort().map((identity) => {
        const wall = topology.walls[identity];
        return [identity, { ...wall }];
    }));
    return { status: topology.status, modelVersion: 1, nodes, walls };
}
function displacement(before, after) {
    return { xUm: after.xUm - before.xUm, yUm: after.yUm - before.yUm };
}
function exactPoint(value, label) {
    if (!value || typeof value !== "object")
        throw inputError(`${label} must be an object.`);
    return {
        xUm: exactCoordinate(value.xUm, `${label}.xUm`),
        yUm: exactCoordinate(value.yUm, `${label}.yUm`),
    };
}
function exactCoordinate(value, label) {
    if (!Number.isSafeInteger(value))
        throw inputError(`${label} must be a safe integer number of micrometres.`);
    return coordinateUm(value);
}
function safeAdd(left, right, label) {
    return exactCoordinate(left + right, label);
}
function safeSubtract(left, right, label) {
    return exactCoordinate(left - right, label);
}
function validateInputTopology(value) {
    try {
        return validateTopologyV2(value, "topology");
    }
    catch (error) {
        throw inputError(`Input topology is invalid: ${errorMessage(error)}`, error);
    }
}
function inputError(message, cause) {
    return cause === undefined
        ? new TopologyMoveError("input", message)
        : new TopologyMoveError("input", message, { cause });
}
function candidateError(stage, error) {
    return new TopologyMoveError(stage, `Topology move rejected during ${stage}: ${errorMessage(error)}`, { cause: error });
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=movement.js.map