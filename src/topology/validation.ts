import { coordinateUm, positiveLengthUm } from "../core/units.js";
import {
  nodeId,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "./model.js";

export class TopologyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopologyValidationError";
  }
}

export function validateTopologyV2(value: unknown, path = "project.topology"): TopologyV2 {
  const topology = record(value, path);
  exactKeys(topology, ["status", "modelVersion", "nodes", "walls"], path);
  if (topology.status !== "empty" && topology.status !== "active") {
    fail(`${path}.status must be "empty" or "active".`);
  }
  if (topology.modelVersion !== 1) fail(`${path}.modelVersion must equal 1.`);

  const rawNodes = record(topology.nodes, `${path}.nodes`);
  const rawWalls = record(topology.walls, `${path}.walls`);
  const nodes = {} as Record<NodeId, TopologyNode>;
  const walls = {} as Record<WallId, TopologyWall>;
  const seenNodeIds = new Set<NodeId>();
  const seenWallIds = new Set<WallId>();

  for (const [key, rawNode] of Object.entries(rawNodes)) {
    const node = validateNode(rawNode, `${path}.nodes[${JSON.stringify(key)}]`);
    if (seenNodeIds.has(node.id)) fail(`Duplicate topology node ID ${node.id}.`);
    seenNodeIds.add(node.id);
    if (key !== node.id) fail(`Topology node record key ${key} must match entity ID ${node.id}.`);
    nodes[node.id] = node;
  }

  const physicalSegments = new Map<string, WallId>();
  for (const [key, rawWall] of Object.entries(rawWalls)) {
    const wall = validateWall(rawWall, `${path}.walls[${JSON.stringify(key)}]`);
    if (seenWallIds.has(wall.id)) fail(`Duplicate topology wall ID ${wall.id}.`);
    seenWallIds.add(wall.id);
    if (key !== wall.id) fail(`Topology wall record key ${key} must match entity ID ${wall.id}.`);

    if (wall.startNodeId === wall.endNodeId) {
      fail(`Topology wall ${wall.id} uses node ${wall.startNodeId} for both endpoints.`);
    }
    const start = nodes[wall.startNodeId];
    if (!start) fail(`Topology wall ${wall.id} references missing start node ${wall.startNodeId}.`);
    const end = nodes[wall.endNodeId];
    if (!end) fail(`Topology wall ${wall.id} references missing end node ${wall.endNodeId}.`);
    if (start.xUm === end.xUm && start.yUm === end.yUm) {
      fail(`Topology wall ${wall.id} is geometrically zero-length.`);
    }
    if (start.xUm !== end.xUm && start.yUm !== end.yUm) {
      fail(`Topology wall ${wall.id} is diagonal; A2 supports orthogonal walls only.`);
    }
    const length = start.xUm === end.xUm ? Math.abs(end.yUm - start.yUm) : Math.abs(end.xUm - start.xUm);
    if (!Number.isSafeInteger(length)) fail(`Topology wall ${wall.id} length is outside the safe integer range.`);

    const segmentKey = [wall.startNodeId, wall.endNodeId].sort().join("\u0000");
    const existingWallId = physicalSegments.get(segmentKey);
    if (existingWallId) {
      fail(`Topology wall ${wall.id} duplicates physical segment ${existingWallId}.`);
    }
    physicalSegments.set(segmentKey, wall.id);
    walls[wall.id] = wall;
  }

  const occupiedCoordinates = new Map<string, NodeId>();
  for (const node of Object.values(nodes)) {
    const coordinateKey = `${node.xUm},${node.yUm}`;
    const existingNodeId = occupiedCoordinates.get(coordinateKey);
    if (existingNodeId) {
      fail(`Topology node ${node.id} is coincident with disconnected node ${existingNodeId}.`);
    }
    occupiedCoordinates.set(coordinateKey, node.id);
  }

  if (topology.status === "empty" && (Object.keys(nodes).length !== 0 || Object.keys(walls).length !== 0)) {
    fail(`${path} with status "empty" must not contain nodes or walls.`);
  }

  return { status: topology.status, modelVersion: 1, nodes, walls };
}

function validateNode(value: unknown, path: string): TopologyNode {
  const node = record(value, path);
  exactKeys(node, ["id", "xUm", "yUm"], path);
  return {
    id: validateNodeId(node.id, `${path}.id`),
    xUm: coordinateUm(safeInteger(node.xUm, `${path}.xUm`), `${path}.xUm`),
    yUm: coordinateUm(safeInteger(node.yUm, `${path}.yUm`), `${path}.yUm`),
  };
}

function validateWall(value: unknown, path: string): TopologyWall {
  const wall = record(value, path);
  exactKeys(wall, ["id", "startNodeId", "endNodeId", "thicknessUm"], path);
  const thicknessUm = safeInteger(wall.thicknessUm, `${path}.thicknessUm`);
  if (thicknessUm <= 0) fail(`${path}.thicknessUm must be greater than zero.`);
  return {
    id: validateWallId(wall.id, `${path}.id`),
    startNodeId: validateNodeId(wall.startNodeId, `${path}.startNodeId`),
    endNodeId: validateNodeId(wall.endNodeId, `${path}.endNodeId`),
    thicknessUm: positiveLengthUm(thicknessUm, `${path}.thicknessUm`),
  };
}

function validateNodeId(value: unknown, path: string): NodeId {
  if (typeof value !== "string") fail(`${path} must be a string.`);
  try {
    return nodeId(value);
  } catch {
    fail(`${path} must be a stable ID beginning with "n-".`);
  }
}

function validateWallId(value: unknown, path: string): WallId {
  if (typeof value !== "string") fail(`${path} must be a string.`);
  try {
    return wallId(value);
  } catch {
    fail(`${path} must be a stable ID beginning with "w-".`);
  }
}

function safeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail(`${path} must be a safe integer.`);
  return value;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  for (const key of required) if (!(key in value)) fail(`${path}.${key} is required.`);
  const allowed = new Set(required);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key} is not supported.`);
}

function fail(message: string): never {
  throw new TopologyValidationError(message);
}
