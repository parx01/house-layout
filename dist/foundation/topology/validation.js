import { coordinateUm, positiveLengthUm } from "../core/units.js";
import { nodeId, wallId, } from "./model.js";
export class TopologyValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "TopologyValidationError";
    }
}
export function validateTopologyV2(value, path = "project.topology") {
    const topology = record(value, path);
    exactKeys(topology, ["status", "modelVersion", "nodes", "walls"], path);
    if (topology.status !== "empty" && topology.status !== "active") {
        fail(`${path}.status must be "empty" or "active".`);
    }
    if (topology.modelVersion !== 1)
        fail(`${path}.modelVersion must equal 1.`);
    const rawNodes = record(topology.nodes, `${path}.nodes`);
    const rawWalls = record(topology.walls, `${path}.walls`);
    const nodes = {};
    const walls = {};
    const seenNodeIds = new Set();
    const seenWallIds = new Set();
    for (const [key, rawNode] of Object.entries(rawNodes)) {
        const node = validateNode(rawNode, `${path}.nodes[${JSON.stringify(key)}]`);
        if (seenNodeIds.has(node.id))
            fail(`Duplicate topology node ID ${node.id}.`);
        seenNodeIds.add(node.id);
        if (key !== node.id)
            fail(`Topology node record key ${key} must match entity ID ${node.id}.`);
        nodes[node.id] = node;
    }
    const physicalSegments = new Map();
    for (const [key, rawWall] of Object.entries(rawWalls)) {
        const wall = validateWall(rawWall, `${path}.walls[${JSON.stringify(key)}]`);
        if (seenWallIds.has(wall.id))
            fail(`Duplicate topology wall ID ${wall.id}.`);
        seenWallIds.add(wall.id);
        if (key !== wall.id)
            fail(`Topology wall record key ${key} must match entity ID ${wall.id}.`);
        if (wall.startNodeId === wall.endNodeId) {
            fail(`Topology wall ${wall.id} uses node ${wall.startNodeId} for both endpoints.`);
        }
        const start = nodes[wall.startNodeId];
        if (!start)
            fail(`Topology wall ${wall.id} references missing start node ${wall.startNodeId}.`);
        const end = nodes[wall.endNodeId];
        if (!end)
            fail(`Topology wall ${wall.id} references missing end node ${wall.endNodeId}.`);
        if (start.xUm === end.xUm && start.yUm === end.yUm) {
            fail(`Topology wall ${wall.id} is geometrically zero-length.`);
        }
        if (start.xUm !== end.xUm && start.yUm !== end.yUm) {
            fail(`Topology wall ${wall.id} is diagonal; A2 supports orthogonal walls only.`);
        }
        const length = start.xUm === end.xUm ? Math.abs(end.yUm - start.yUm) : Math.abs(end.xUm - start.xUm);
        if (!Number.isSafeInteger(length))
            fail(`Topology wall ${wall.id} length is outside the safe integer range.`);
        const segmentKey = [wall.startNodeId, wall.endNodeId].sort().join("\u0000");
        const existingWallId = physicalSegments.get(segmentKey);
        if (existingWallId) {
            fail(`Topology wall ${wall.id} duplicates physical segment ${existingWallId}.`);
        }
        physicalSegments.set(segmentKey, wall.id);
        walls[wall.id] = wall;
    }
    const occupiedCoordinates = new Map();
    for (const node of Object.values(nodes)) {
        const coordinateKey = `${node.xUm},${node.yUm}`;
        const existingNodeId = occupiedCoordinates.get(coordinateKey);
        if (existingNodeId) {
            fail(`Topology node ${node.id} is coincident with disconnected node ${existingNodeId}.`);
        }
        occupiedCoordinates.set(coordinateKey, node.id);
    }
    validateCanonicalRelationships(nodes, walls);
    if (topology.status === "empty" && (Object.keys(nodes).length !== 0 || Object.keys(walls).length !== 0)) {
        fail(`${path} with status "empty" must not contain nodes or walls.`);
    }
    return { status: topology.status, modelVersion: 1, nodes, walls };
}
function validateCanonicalRelationships(nodes, walls) {
    const wallValues = Object.values(walls);
    for (let leftIndex = 0; leftIndex < wallValues.length; leftIndex += 1) {
        const left = wallValues[leftIndex];
        const leftStart = nodes[left.startNodeId];
        const leftEnd = nodes[left.endNodeId];
        const leftHorizontal = leftStart.yUm === leftEnd.yUm;
        for (let rightIndex = leftIndex + 1; rightIndex < wallValues.length; rightIndex += 1) {
            const right = wallValues[rightIndex];
            const rightStart = nodes[right.startNodeId];
            const rightEnd = nodes[right.endNodeId];
            const rightHorizontal = rightStart.yUm === rightEnd.yUm;
            if (leftHorizontal === rightHorizontal) {
                const sameLine = leftHorizontal ? leftStart.yUm === rightStart.yUm : leftStart.xUm === rightStart.xUm;
                if (!sameLine)
                    continue;
                const leftRange = leftHorizontal
                    ? orderedRange(leftStart.xUm, leftEnd.xUm)
                    : orderedRange(leftStart.yUm, leftEnd.yUm);
                const rightRange = rightHorizontal
                    ? orderedRange(rightStart.xUm, rightEnd.xUm)
                    : orderedRange(rightStart.yUm, rightEnd.yUm);
                if (Math.max(leftRange.min, rightRange.min) < Math.min(leftRange.max, rightRange.max)) {
                    fail(`Topology walls ${left.id} and ${right.id} overlap collinearly.`);
                }
                continue;
            }
            const horizontalStart = leftHorizontal ? leftStart : rightStart;
            const horizontalEnd = leftHorizontal ? leftEnd : rightEnd;
            const verticalStart = leftHorizontal ? rightStart : leftStart;
            const verticalEnd = leftHorizontal ? rightEnd : leftEnd;
            const intersects = between(verticalStart.xUm, horizontalStart.xUm, horizontalEnd.xUm) &&
                between(horizontalStart.yUm, verticalStart.yUm, verticalEnd.yUm);
            if (!intersects)
                continue;
            const horizontalInterior = strictlyBetween(verticalStart.xUm, horizontalStart.xUm, horizontalEnd.xUm);
            const verticalInterior = strictlyBetween(horizontalStart.yUm, verticalStart.yUm, verticalEnd.yUm);
            if (horizontalInterior || verticalInterior) {
                fail(`Topology walls ${left.id} and ${right.id} intersect without canonical splitting.`);
            }
        }
    }
    for (const node of Object.values(nodes)) {
        for (const wall of wallValues) {
            if (wall.startNodeId === node.id || wall.endNodeId === node.id)
                continue;
            const start = nodes[wall.startNodeId];
            const end = nodes[wall.endNodeId];
            if (pointStrictlyInsideSegment(node, start, end)) {
                fail(`Topology node ${node.id} lies on the unsplit interior of wall ${wall.id}.`);
            }
        }
    }
}
function pointStrictlyInsideSegment(point, start, end) {
    if (start.xUm === end.xUm) {
        return point.xUm === start.xUm && strictlyBetween(point.yUm, start.yUm, end.yUm);
    }
    return point.yUm === start.yUm && strictlyBetween(point.xUm, start.xUm, end.xUm);
}
function orderedRange(a, b) {
    return { min: Math.min(a, b), max: Math.max(a, b) };
}
function between(value, a, b) {
    return value >= Math.min(a, b) && value <= Math.max(a, b);
}
function strictlyBetween(value, a, b) {
    return value > Math.min(a, b) && value < Math.max(a, b);
}
function validateNode(value, path) {
    const node = record(value, path);
    exactKeys(node, ["id", "xUm", "yUm"], path);
    return {
        id: validateNodeId(node.id, `${path}.id`),
        xUm: coordinateUm(safeInteger(node.xUm, `${path}.xUm`), `${path}.xUm`),
        yUm: coordinateUm(safeInteger(node.yUm, `${path}.yUm`), `${path}.yUm`),
    };
}
function validateWall(value, path) {
    const wall = record(value, path);
    exactKeys(wall, ["id", "startNodeId", "endNodeId", "thicknessUm"], path);
    const thicknessUm = safeInteger(wall.thicknessUm, `${path}.thicknessUm`);
    if (thicknessUm <= 0)
        fail(`${path}.thicknessUm must be greater than zero.`);
    return {
        id: validateWallId(wall.id, `${path}.id`),
        startNodeId: validateNodeId(wall.startNodeId, `${path}.startNodeId`),
        endNodeId: validateNodeId(wall.endNodeId, `${path}.endNodeId`),
        thicknessUm: positiveLengthUm(thicknessUm, `${path}.thicknessUm`),
    };
}
function validateNodeId(value, path) {
    if (typeof value !== "string")
        fail(`${path} must be a string.`);
    try {
        return nodeId(value);
    }
    catch {
        fail(`${path} must be a stable ID beginning with "n-".`);
    }
}
function validateWallId(value, path) {
    if (typeof value !== "string")
        fail(`${path} must be a string.`);
    try {
        return wallId(value);
    }
    catch {
        fail(`${path} must be a stable ID beginning with "w-".`);
    }
}
function safeInteger(value, path) {
    if (typeof value !== "number" || !Number.isSafeInteger(value))
        fail(`${path} must be a safe integer.`);
    return value;
}
function record(value, path) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        fail(`${path} must be an object.`);
    return value;
}
function exactKeys(value, required, path) {
    for (const key of required)
        if (!(key in value))
            fail(`${path}.${key} is required.`);
    const allowed = new Set(required);
    for (const key of Object.keys(value))
        if (!allowed.has(key))
            fail(`${path}.${key} is not supported.`);
}
function fail(message) {
    throw new TopologyValidationError(message);
}
//# sourceMappingURL=validation.js.map