import { inches, lengthUm } from "../core/units.js";
export const WALL_THICKNESS_4_5_IN_UM = lengthUm(114_300);
export const WALL_THICKNESS_9_IN_UM = inches(9);
export function nodeId(value) {
    if (!/^n-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
        throw new TypeError(`Invalid topology node ID: ${JSON.stringify(value)}.`);
    }
    return value;
}
export function wallId(value) {
    if (!/^w-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
        throw new TypeError(`Invalid topology wall ID: ${JSON.stringify(value)}.`);
    }
    return value;
}
export function createEmptyTopologyV2() {
    return { status: "empty", modelVersion: 1, nodes: {}, walls: {} };
}
export function getWallStartNode(topology, id) {
    const wall = getWall(topology, id);
    return getNode(topology, wall.startNodeId, `wall ${id} start`);
}
export function getWallEndNode(topology, id) {
    const wall = getWall(topology, id);
    return getNode(topology, wall.endNodeId, `wall ${id} end`);
}
export function getWallOrientation(topology, id) {
    const start = getWallStartNode(topology, id);
    const end = getWallEndNode(topology, id);
    const sameX = start.xUm === end.xUm;
    const sameY = start.yUm === end.yUm;
    if (sameX === sameY) {
        throw new RangeError(`Topology wall ${id} is not a non-zero orthogonal segment.`);
    }
    return sameY ? "horizontal" : "vertical";
}
export function getWallLength(topology, id) {
    const start = getWallStartNode(topology, id);
    const end = getWallEndNode(topology, id);
    const orientation = getWallOrientation(topology, id);
    const value = orientation === "horizontal" ? Math.abs(end.xUm - start.xUm) : Math.abs(end.yUm - start.yUm);
    return lengthUm(value, `topology wall ${id} length`);
}
export function getConnectedWallIds(topology, id) {
    getNode(topology, id, "connected-wall lookup");
    return Object.values(topology.walls)
        .filter((wall) => wall.startNodeId === id || wall.endNodeId === id)
        .map((wall) => wall.id);
}
function getWall(topology, id) {
    const wall = topology.walls[id];
    if (!wall)
        throw new ReferenceError(`Topology wall ${id} does not exist.`);
    return wall;
}
function getNode(topology, id, context) {
    const node = topology.nodes[id];
    if (!node)
        throw new ReferenceError(`Topology node ${id} does not exist for ${context}.`);
    return node;
}
//# sourceMappingURL=model.js.map