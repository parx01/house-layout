import { inches, lengthUm, type CoordinateUm, type LengthUm } from "../core/units.js";

declare const nodeIdBrand: unique symbol;
declare const wallIdBrand: unique symbol;

export type NodeId = string & { readonly [nodeIdBrand]: "NodeId" };
export type WallId = string & { readonly [wallIdBrand]: "WallId" };

export interface TopologyNode {
  readonly id: NodeId;
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
}

/** A physical wall centre-line between two canonical junction nodes. */
export interface TopologyWall {
  readonly id: WallId;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
  readonly thicknessUm: LengthUm;
}

export interface TopologyV2 {
  readonly status: "empty" | "active";
  readonly modelVersion: 1;
  readonly nodes: Record<NodeId, TopologyNode>;
  readonly walls: Record<WallId, TopologyWall>;
}

export type WallOrientation = "horizontal" | "vertical";

export const WALL_THICKNESS_4_5_IN_UM = lengthUm(114_300);
export const WALL_THICKNESS_9_IN_UM = inches(9);

export function nodeId(value: string): NodeId {
  if (!/^n-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new TypeError(`Invalid topology node ID: ${JSON.stringify(value)}.`);
  }
  return value as NodeId;
}

export function wallId(value: string): WallId {
  if (!/^w-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new TypeError(`Invalid topology wall ID: ${JSON.stringify(value)}.`);
  }
  return value as WallId;
}

export function createEmptyTopologyV2(): TopologyV2 {
  return { status: "empty", modelVersion: 1, nodes: {}, walls: {} };
}

export function getWallStartNode(topology: TopologyV2, id: WallId): TopologyNode {
  const wall = getWall(topology, id);
  return getNode(topology, wall.startNodeId, `wall ${id} start`);
}

export function getWallEndNode(topology: TopologyV2, id: WallId): TopologyNode {
  const wall = getWall(topology, id);
  return getNode(topology, wall.endNodeId, `wall ${id} end`);
}

export function getWallOrientation(topology: TopologyV2, id: WallId): WallOrientation {
  const start = getWallStartNode(topology, id);
  const end = getWallEndNode(topology, id);
  const sameX = start.xUm === end.xUm;
  const sameY = start.yUm === end.yUm;
  if (sameX === sameY) {
    throw new RangeError(`Topology wall ${id} is not a non-zero orthogonal segment.`);
  }
  return sameY ? "horizontal" : "vertical";
}

export function getWallLength(topology: TopologyV2, id: WallId): LengthUm {
  const start = getWallStartNode(topology, id);
  const end = getWallEndNode(topology, id);
  const orientation = getWallOrientation(topology, id);
  const value = orientation === "horizontal" ? Math.abs(end.xUm - start.xUm) : Math.abs(end.yUm - start.yUm);
  return lengthUm(value, `topology wall ${id} length`);
}

export function getConnectedWallIds(topology: TopologyV2, id: NodeId): WallId[] {
  getNode(topology, id, "connected-wall lookup");
  return Object.values(topology.walls)
    .filter((wall) => wall.startNodeId === id || wall.endNodeId === id)
    .map((wall) => wall.id);
}

function getWall(topology: TopologyV2, id: WallId): TopologyWall {
  const wall = topology.walls[id];
  if (!wall) throw new ReferenceError(`Topology wall ${id} does not exist.`);
  return wall;
}

function getNode(topology: TopologyV2, id: NodeId, context: string): TopologyNode {
  const node = topology.nodes[id];
  if (!node) throw new ReferenceError(`Topology node ${id} does not exist for ${context}.`);
  return node;
}
