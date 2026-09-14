import { coordinateUm, positiveLengthUm } from "../core/units.js";
import { getConnectedWallIds, getWallEndNode, getWallOrientation, getWallStartNode, nodeId, wallId, } from "./model.js";
import { validateTopologyV2 } from "./validation.js";
export class TopologyOperationError extends Error {
    constructor(message) {
        super(message);
        this.name = "TopologyOperationError";
    }
}
export function findNodeAtCoordinate(topology, point) {
    return Object.values(topology.nodes).find((node) => node.xUm === point.xUm && node.yUm === point.yUm);
}
export function getWallsAtNode(topology, id) {
    return getConnectedWallIds(topology, id).map((wallIdentity) => topology.walls[wallIdentity]);
}
export function findWallIntersections(topologyValue, proposalValue) {
    const topology = validateTopologyV2(topologyValue);
    const proposal = validateProposal(proposalValue);
    const proposalOrientation = proposalAxis(proposal);
    const intersections = [];
    for (const existingWallId of sortedWallIds(topology)) {
        const existingOrientation = getWallOrientation(topology, existingWallId);
        const existingStart = getWallStartNode(topology, existingWallId);
        const existingEnd = getWallEndNode(topology, existingWallId);
        if (proposalOrientation === existingOrientation) {
            const conflict = classifyCollinearRelationship(proposal, existingStart, existingEnd, existingOrientation);
            if (conflict === "none")
                continue;
            if (conflict === "exactDuplicate" || conflict === "collinearOverlap") {
                intersections.push({ kind: conflict, wallId: existingWallId });
                continue;
            }
            intersections.push({
                kind: "endpointEndpoint",
                wallId: existingWallId,
                point: conflict,
            });
            continue;
        }
        const point = perpendicularIntersection(proposal, existingStart, existingEnd, proposalOrientation);
        if (!point)
            continue;
        const proposalEndpoint = pointsEqual(point, proposal.start) || pointsEqual(point, proposal.end);
        const existingEndpoint = pointsEqual(point, existingStart) || pointsEqual(point, existingEnd);
        intersections.push({
            kind: proposalEndpoint
                ? existingEndpoint
                    ? "endpointEndpoint"
                    : "proposedEndpointToExistingInterior"
                : existingEndpoint
                    ? "existingEndpointToProposedInterior"
                    : "interiorCrossing",
            wallId: existingWallId,
            point,
        });
    }
    return intersections;
}
export function splitWallAtPoint(topologyValue, wallIdentity, pointValue, options) {
    const topology = validateTopologyV2(topologyValue);
    const point = validatePoint(pointValue, "split point");
    const wall = topology.walls[wallIdentity];
    if (!wall)
        throw new TopologyOperationError(`Topology wall ${wallIdentity} does not exist.`);
    const start = getWallStartNode(topology, wallIdentity);
    const end = getWallEndNode(topology, wallIdentity);
    if (!pointOnSegment(point, start, end)) {
        throw new TopologyOperationError(`Split point is not on topology wall ${wallIdentity}.`);
    }
    if (pointsEqual(point, start) || pointsEqual(point, end))
        return unchangedResult(topology);
    const candidate = mutableClone(topology);
    const allocator = createIdAllocator(candidate, options.idSeed);
    const createdNodeIds = [];
    const splitNodeId = findNodeAtCoordinate(candidate, point)?.id ?? createNode(candidate, point, allocator, createdNodeIds);
    const createdWallIds = [];
    const replacements = replaceWallWithSegments(candidate, wall, [splitNodeId], allocator, createdWallIds);
    const result = validateTopologyV2(candidate);
    return {
        topology: result,
        createdNodeIds,
        createdWallIds,
        removedWallIds: [wallIdentity],
        insertedWallIds: [],
        wallReplacements: { [wallIdentity]: replacements },
    };
}
export function insertWall(topologyValue, proposalValue, options) {
    const topology = validateTopologyV2(topologyValue);
    const proposal = validateProposal(proposalValue);
    const intersections = findWallIntersections(topology, proposal);
    const conflict = intersections.find((intersection) => intersection.kind === "exactDuplicate" || intersection.kind === "collinearOverlap");
    if (conflict) {
        throw new TopologyOperationError(conflict.kind === "exactDuplicate"
            ? `Proposed wall duplicates topology wall ${conflict.wallId}.`
            : `Proposed wall overlaps collinearly with topology wall ${conflict.wallId}.`);
    }
    const candidate = mutableClone(topology);
    const allocator = createIdAllocator(candidate, options.idSeed);
    const createdNodeIds = [];
    const createdWallIds = [];
    const removedWallIds = [];
    const wallReplacements = {};
    const canonicalPoints = uniqueSortedPoints([
        proposal.start,
        proposal.end,
        ...intersections
            .filter((intersection) => "point" in intersection)
            .map((intersection) => intersection.point),
        ...Object.values(topology.nodes)
            .filter((node) => pointOnSegment(node, proposal.start, proposal.end))
            .map((node) => ({ xUm: node.xUm, yUm: node.yUm })),
    ]);
    const nodeIdsByCoordinate = new Map();
    for (const point of canonicalPoints) {
        const existingNode = findNodeAtCoordinate(candidate, point);
        const id = existingNode?.id ?? createNode(candidate, point, allocator, createdNodeIds);
        nodeIdsByCoordinate.set(pointKey(point), id);
    }
    const splitPointsByWall = new Map();
    for (const intersection of intersections) {
        if (!("point" in intersection))
            continue;
        const existingStart = getWallStartNode(topology, intersection.wallId);
        const existingEnd = getWallEndNode(topology, intersection.wallId);
        if (pointsEqual(intersection.point, existingStart) || pointsEqual(intersection.point, existingEnd))
            continue;
        const points = splitPointsByWall.get(intersection.wallId) ?? [];
        points.push(intersection.point);
        splitPointsByWall.set(intersection.wallId, points);
    }
    for (const existingWallId of [...splitPointsByWall.keys()].sort()) {
        const wall = candidate.walls[existingWallId];
        const splitNodeIds = uniqueSortedPoints(splitPointsByWall.get(existingWallId)).map((point) => nodeIdsByCoordinate.get(pointKey(point)));
        const replacements = replaceWallWithSegments(candidate, wall, splitNodeIds, allocator, createdWallIds);
        removedWallIds.push(existingWallId);
        wallReplacements[existingWallId] = replacements;
    }
    const insertedNodeIds = canonicalPoints.map((point) => nodeIdsByCoordinate.get(pointKey(point)));
    const insertedWallIds = createSegmentsForNodePath(candidate, { thicknessUm: proposal.thicknessUm }, insertedNodeIds, allocator, createdWallIds);
    candidate.status = "active";
    const result = validateTopologyV2(candidate);
    return {
        topology: result,
        createdNodeIds,
        createdWallIds,
        removedWallIds,
        insertedWallIds,
        wallReplacements,
    };
}
function replaceWallWithSegments(topology, wall, splitNodeIds, allocator, createdWallIds) {
    delete topology.walls[wall.id];
    return createSegmentsForNodePath(topology, wall, [wall.startNodeId, ...splitNodeIds, wall.endNodeId], allocator, createdWallIds);
}
function createSegmentsForNodePath(topology, wallData, nodeIds, allocator, createdWallIds) {
    const sortedNodeIds = [...new Set(nodeIds)].sort((leftId, rightId) => comparePoints(topology.nodes[leftId], topology.nodes[rightId]));
    const result = [];
    for (let index = 0; index < sortedNodeIds.length - 1; index += 1) {
        const startNodeId = sortedNodeIds[index];
        const endNodeId = sortedNodeIds[index + 1];
        const id = allocator.nextWallId();
        topology.walls[id] = { id, startNodeId, endNodeId, thicknessUm: wallData.thicknessUm };
        createdWallIds.push(id);
        result.push(id);
    }
    return result;
}
function createNode(topology, point, allocator, createdNodeIds) {
    const id = allocator.nextNodeId();
    topology.nodes[id] = { id, xUm: point.xUm, yUm: point.yUm };
    createdNodeIds.push(id);
    return id;
}
function classifyCollinearRelationship(proposal, existingStart, existingEnd, orientation) {
    const sameLine = orientation === "horizontal"
        ? proposal.start.yUm === existingStart.yUm
        : proposal.start.xUm === existingStart.xUm;
    if (!sameLine)
        return "none";
    const proposalRange = coordinateRange(proposal.start, proposal.end, orientation);
    const existingRange = coordinateRange(existingStart, existingEnd, orientation);
    const overlapStart = Math.max(proposalRange.min, existingRange.min);
    const overlapEnd = Math.min(proposalRange.max, existingRange.max);
    if (overlapStart > overlapEnd)
        return "none";
    if (overlapStart < overlapEnd) {
        const sameRange = proposalRange.min === existingRange.min && proposalRange.max === existingRange.max;
        return sameRange ? "exactDuplicate" : "collinearOverlap";
    }
    return orientation === "horizontal"
        ? point(coordinateUm(overlapStart), proposal.start.yUm)
        : point(proposal.start.xUm, coordinateUm(overlapStart));
}
function perpendicularIntersection(proposal, existingStart, existingEnd, proposalOrientation) {
    const candidate = proposalOrientation === "horizontal"
        ? point(existingStart.xUm, proposal.start.yUm)
        : point(proposal.start.xUm, existingStart.yUm);
    return pointOnSegment(candidate, proposal.start, proposal.end) && pointOnSegment(candidate, existingStart, existingEnd)
        ? candidate
        : null;
}
function validateProposal(value) {
    const start = validatePoint(value.start, "proposed wall start");
    const end = validatePoint(value.end, "proposed wall end");
    const thickness = value.thicknessUm;
    if (!Number.isSafeInteger(thickness) || thickness <= 0) {
        throw new TopologyOperationError("Proposed wall thicknessUm must be a positive safe integer.");
    }
    if (pointsEqual(start, end))
        throw new TopologyOperationError("Proposed wall must not be zero-length.");
    if (start.xUm !== end.xUm && start.yUm !== end.yUm) {
        throw new TopologyOperationError("Proposed wall must be horizontal or vertical; diagonal geometry is not supported.");
    }
    const segmentLength = start.xUm === end.xUm
        ? Math.abs(end.yUm - start.yUm)
        : Math.abs(end.xUm - start.xUm);
    if (!Number.isSafeInteger(segmentLength)) {
        throw new TopologyOperationError("Proposed wall length must remain within the safe integer range.");
    }
    return { start, end, thicknessUm: positiveLengthUm(thickness) };
}
function validatePoint(value, label) {
    if (!value || typeof value !== "object")
        throw new TopologyOperationError(`${label} must be an object.`);
    if (!Number.isSafeInteger(value.xUm) || !Number.isSafeInteger(value.yUm)) {
        throw new TopologyOperationError(`${label} coordinates must be safe integers.`);
    }
    return { xUm: coordinateUm(value.xUm), yUm: coordinateUm(value.yUm) };
}
function proposalAxis(proposal) {
    return proposal.start.yUm === proposal.end.yUm ? "horizontal" : "vertical";
}
function pointOnSegment(pointValue, start, end) {
    if (start.xUm === end.xUm) {
        return pointValue.xUm === start.xUm && between(pointValue.yUm, start.yUm, end.yUm);
    }
    if (start.yUm === end.yUm) {
        return pointValue.yUm === start.yUm && between(pointValue.xUm, start.xUm, end.xUm);
    }
    return false;
}
function between(value, a, b) {
    return value >= Math.min(a, b) && value <= Math.max(a, b);
}
function coordinateRange(start, end, orientation) {
    const startValue = orientation === "horizontal" ? start.xUm : start.yUm;
    const endValue = orientation === "horizontal" ? end.xUm : end.yUm;
    return { min: Math.min(startValue, endValue), max: Math.max(startValue, endValue) };
}
function uniqueSortedPoints(points) {
    const unique = new Map();
    for (const value of points)
        unique.set(pointKey(value), value);
    return [...unique.values()].sort(comparePoints);
}
function comparePoints(left, right) {
    if (left.xUm !== right.xUm)
        return left.xUm < right.xUm ? -1 : 1;
    if (left.yUm !== right.yUm)
        return left.yUm < right.yUm ? -1 : 1;
    return 0;
}
function pointsEqual(left, right) {
    return left.xUm === right.xUm && left.yUm === right.yUm;
}
function pointKey(value) {
    return `${value.xUm},${value.yUm}`;
}
function point(xUm, yUm) {
    return { xUm, yUm };
}
function sortedWallIds(topology) {
    return Object.keys(topology.walls).sort().map(wallId);
}
function mutableClone(topology) {
    return {
        status: topology.status,
        modelVersion: 1,
        nodes: Object.fromEntries(Object.entries(topology.nodes).map(([id, value]) => [id, { ...value }])),
        walls: Object.fromEntries(Object.entries(topology.walls).map(([id, value]) => [id, { ...value }])),
    };
}
function createIdAllocator(topology, seedValue) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(seedValue)) {
        throw new TopologyOperationError("Topology operation idSeed must contain only stable ID characters.");
    }
    const usedNodeIds = new Set(Object.keys(topology.nodes));
    const usedWallIds = new Set(Object.keys(topology.walls));
    let nodeIndex = 1;
    let wallIndex = 1;
    return {
        nextNodeId() {
            while (true) {
                const candidate = nodeId(`n-${seedValue}-${nodeIndex++}`);
                if (!usedNodeIds.has(candidate)) {
                    usedNodeIds.add(candidate);
                    return candidate;
                }
            }
        },
        nextWallId() {
            while (true) {
                const candidate = wallId(`w-${seedValue}-${wallIndex++}`);
                if (!usedWallIds.has(candidate)) {
                    usedWallIds.add(candidate);
                    return candidate;
                }
            }
        },
    };
}
function unchangedResult(topology) {
    return {
        topology,
        createdNodeIds: [],
        createdWallIds: [],
        removedWallIds: [],
        insertedWallIds: [],
        wallReplacements: {},
    };
}
//# sourceMappingURL=operations.js.map