import { coordinateUm, type AreaUm2, type CoordinateUm } from "../core/units.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import type { FaceId } from "../spaces/model.js";
import {
  getConnectedWallIds,
  getWallOrientation,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
  type WallOrientation,
} from "./model.js";
import { validateTopologyV2 } from "./validation.js";

export type TopologyMoveFailureStage = "input" | "candidateTopology" | "candidateFaces" | "facePreservation";

export class TopologyMoveError extends Error {
  constructor(
    readonly stage: TopologyMoveFailureStage,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TopologyMoveError";
  }
}

export interface NodeCoordinateChange {
  readonly nodeId: NodeId;
  readonly before: TopologyMovePoint;
  readonly after: TopologyMovePoint;
}

export interface FaceAreaChange {
  readonly faceId: FaceId;
  readonly beforeAreaUm2: AreaUm2;
  readonly afterAreaUm2: AreaUm2;
}

export interface TopologyMovePoint {
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
}

interface TopologyMoveMetadataBase {
  readonly nodeChanges: readonly NodeCoordinateChange[];
  /** Every wall with at least one moved endpoint. */
  readonly affectedWallIds: readonly WallId[];
  /** Walls whose two endpoints received the same displacement. */
  readonly translatedWallIds: readonly WallId[];
  /** Affected walls whose endpoint displacements differ. */
  readonly resizedWallIds: readonly WallId[];
  readonly preservedFaceIds: readonly FaceId[];
  readonly faceCountBefore: number;
  readonly faceCountAfter: number;
  /** Only faces whose exact derived area changed are included. */
  readonly faceAreaChanges: readonly FaceAreaChange[];
}

export interface WallPerpendicularMoveMetadata extends TopologyMoveMetadataBase {
  readonly kind: "wallPerpendicular";
  readonly wallId: WallId;
  readonly orientation: WallOrientation;
  readonly offsetUm: CoordinateUm;
  /** The complete same-axis run translated with the selected segment. */
  readonly wallRunIds: readonly WallId[];
}

export interface JunctionMoveMetadata extends TopologyMoveMetadataBase {
  readonly kind: "junction";
  readonly nodeId: NodeId;
  readonly target: TopologyMovePoint;
  readonly deltaXUm: CoordinateUm;
  readonly deltaYUm: CoordinateUm;
  readonly xConstraintNodeIds: readonly NodeId[];
  readonly yConstraintNodeIds: readonly NodeId[];
}

export type TopologyMoveMetadata = WallPerpendicularMoveMetadata | JunctionMoveMetadata;

export interface TopologyMoveResult {
  readonly topology: TopologyV2;
  readonly metadata: TopologyMoveMetadata;
}

interface PlannedCoordinates {
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
}

/**
 * Moves the maximal collinear run containing `wallIdentity` perpendicular to
 * that run. Shared nodes move with it and perpendicular incident walls resize.
 */
export function moveWallPerpendicular(
  topologyValue: TopologyV2,
  wallIdentity: WallId,
  offsetUmValue: number,
): TopologyMoveResult {
  const topology = validateInputTopology(topologyValue);
  const wall = topology.walls[wallIdentity];
  if (!wall) throw inputError(`Topology wall ${wallIdentity} does not exist.`);
  const offsetUm = exactCoordinate(offsetUmValue, "Wall movement offsetUm");
  const orientation = getWallOrientation(topology, wallIdentity);
  const runNodeIds = collectAxisComponentNodes(topology, wall.startNodeId, orientation);
  const planned = new Map<NodeId, PlannedCoordinates>();

  for (const nodeIdentity of runNodeIds) {
    const node = topology.nodes[nodeIdentity]!;
    planned.set(nodeIdentity, orientation === "horizontal"
      ? { xUm: node.xUm, yUm: safeAdd(node.yUm, offsetUm, `Wall movement at node ${node.id}`) }
      : { xUm: safeAdd(node.xUm, offsetUm, `Wall movement at node ${node.id}`), yUm: node.yUm });
  }

  const wallRunIds = Object.values(topology.walls)
    .filter((candidate) =>
      getWallOrientation(topology, candidate.id) === orientation &&
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
export function moveJunction(
  topologyValue: TopologyV2,
  nodeIdentity: NodeId,
  targetValue: TopologyMovePoint,
): TopologyMoveResult {
  const topology = validateInputTopology(topologyValue);
  const node = topology.nodes[nodeIdentity];
  if (!node) throw inputError(`Topology node ${nodeIdentity} does not exist.`);
  const target = exactPoint(targetValue, "Junction target");
  const deltaXUm = safeSubtract(target.xUm, node.xUm, "Junction X movement");
  const deltaYUm = safeSubtract(target.yUm, node.yUm, "Junction Y movement");
  const xConstraintNodeIds = collectAxisComponentNodes(topology, nodeIdentity, "vertical");
  const yConstraintNodeIds = collectAxisComponentNodes(topology, nodeIdentity, "horizontal");
  const planned = new Map<NodeId, PlannedCoordinates>();

  for (const constrainedNodeId of xConstraintNodeIds) {
    const constrained = topology.nodes[constrainedNodeId]!;
    planned.set(constrainedNodeId, {
      xUm: safeAdd(constrained.xUm, deltaXUm, `Junction X movement at node ${constrained.id}`),
      yUm: constrained.yUm,
    });
  }
  for (const constrainedNodeId of yConstraintNodeIds) {
    const constrained = topology.nodes[constrainedNodeId]!;
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

function finalizeMove(
  topology: TopologyV2,
  planned: ReadonlyMap<NodeId, PlannedCoordinates>,
  metadata: (base: TopologyMoveMetadataBase) => TopologyMoveMetadata,
): TopologyMoveResult {
  let beforeFaces: ReturnType<typeof extractBoundedFaces>;
  try {
    beforeFaces = extractBoundedFaces(topology);
  } catch (error) {
    throw inputError(`Input topology faces are not movable: ${errorMessage(error)}`, error);
  }
  const candidate = canonicalMutableClone(topology);
  const nodeChanges: NodeCoordinateChange[] = [];

  for (const nodeIdentity of [...planned.keys()].sort()) {
    const before = topology.nodes[nodeIdentity]!;
    const after = planned.get(nodeIdentity)!;
    if (before.xUm === after.xUm && before.yUm === after.yUm) continue;
    candidate.nodes[nodeIdentity] = { id: before.id, xUm: after.xUm, yUm: after.yUm };
    nodeChanges.push({
      nodeId: nodeIdentity,
      before: { xUm: before.xUm, yUm: before.yUm },
      after: { xUm: after.xUm, yUm: after.yUm },
    });
  }

  let committed: TopologyV2;
  try {
    committed = validateTopologyV2(candidate, "candidateTopology");
  } catch (error) {
    throw candidateError("candidateTopology", error);
  }

  let afterFaces: ReturnType<typeof extractBoundedFaces>;
  try {
    afterFaces = extractBoundedFaces(committed);
  } catch (error) {
    throw candidateError("candidateFaces", error);
  }

  const beforeFaceIds = beforeFaces.faces.map((face) => face.id);
  const afterFaceIds = afterFaces.faces.map((face) => face.id);
  if (beforeFaceIds.length !== afterFaceIds.length) {
    throw new TopologyMoveError(
      "facePreservation",
      `Topology move rejected: bounded-face count would change from ${beforeFaceIds.length} to ${afterFaceIds.length}.`,
    );
  }
  if (beforeFaceIds.some((identity, index) => identity !== afterFaceIds[index])) {
    throw new TopologyMoveError(
      "facePreservation",
      "Topology move rejected: a bounded face would collapse, invert, or change its canonical boundary.",
    );
  }

  const changedNodeIds = new Set(nodeChanges.map((change) => change.nodeId));
  const affectedWallIds = Object.values(topology.walls)
    .filter((wall) => changedNodeIds.has(wall.startNodeId) || changedNodeIds.has(wall.endNodeId))
    .map((wall) => wall.id)
    .sort();
  const translatedWallIds: WallId[] = [];
  const resizedWallIds: WallId[] = [];
  for (const wallIdentity of affectedWallIds) {
    const wall = topology.walls[wallIdentity]!;
    const startDisplacement = displacement(topology.nodes[wall.startNodeId]!, committed.nodes[wall.startNodeId]!);
    const endDisplacement = displacement(topology.nodes[wall.endNodeId]!, committed.nodes[wall.endNodeId]!);
    if (startDisplacement.xUm === endDisplacement.xUm && startDisplacement.yUm === endDisplacement.yUm) {
      translatedWallIds.push(wallIdentity);
    } else {
      resizedWallIds.push(wallIdentity);
    }
  }

  const beforeAreas = new Map(beforeFaces.faces.map((face) => [face.id, face.areaUm2]));
  const faceAreaChanges = afterFaces.faces
    .filter((face) => beforeAreas.get(face.id) !== face.areaUm2)
    .map((face) => ({
      faceId: face.id,
      beforeAreaUm2: beforeAreas.get(face.id)!,
      afterAreaUm2: face.areaUm2,
    }));

  const base: TopologyMoveMetadataBase = {
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

function collectAxisComponentNodes(
  topology: TopologyV2,
  startNodeId: NodeId,
  orientation: WallOrientation,
): Set<NodeId> {
  const result = new Set<NodeId>([startNodeId]);
  const pending: NodeId[] = [startNodeId];
  while (pending.length) {
    const current = pending.shift()!;
    const wallIds = getConnectedWallIds(topology, current).sort();
    for (const wallIdentity of wallIds) {
      if (getWallOrientation(topology, wallIdentity) !== orientation) continue;
      const wall = topology.walls[wallIdentity]!;
      const other = wall.startNodeId === current ? wall.endNodeId : wall.startNodeId;
      if (result.has(other)) continue;
      result.add(other);
      pending.push(other);
    }
  }
  return result;
}

function canonicalMutableClone(topology: TopologyV2): {
  status: "empty" | "active";
  modelVersion: 1;
  nodes: Record<NodeId, TopologyNode>;
  walls: Record<WallId, TopologyWall>;
} {
  const nodes = Object.fromEntries(Object.keys(topology.nodes).sort().map((identity) => {
    const node = topology.nodes[identity as NodeId]!;
    return [identity, { ...node }];
  })) as Record<NodeId, TopologyNode>;
  const walls = Object.fromEntries(Object.keys(topology.walls).sort().map((identity) => {
    const wall = topology.walls[identity as WallId]!;
    return [identity, { ...wall }];
  })) as Record<WallId, TopologyWall>;
  return { status: topology.status, modelVersion: 1, nodes, walls };
}

function displacement(before: TopologyNode, after: TopologyNode): { xUm: number; yUm: number } {
  return { xUm: after.xUm - before.xUm, yUm: after.yUm - before.yUm };
}

function exactPoint(value: TopologyMovePoint, label: string): TopologyMovePoint {
  if (!value || typeof value !== "object") throw inputError(`${label} must be an object.`);
  return {
    xUm: exactCoordinate(value.xUm, `${label}.xUm`),
    yUm: exactCoordinate(value.yUm, `${label}.yUm`),
  };
}

function exactCoordinate(value: number, label: string): CoordinateUm {
  if (!Number.isSafeInteger(value)) throw inputError(`${label} must be a safe integer number of micrometres.`);
  return coordinateUm(value);
}

function safeAdd(left: number, right: number, label: string): CoordinateUm {
  return exactCoordinate(left + right, label);
}

function safeSubtract(left: number, right: number, label: string): CoordinateUm {
  return exactCoordinate(left - right, label);
}

function validateInputTopology(value: TopologyV2): TopologyV2 {
  try {
    return validateTopologyV2(value, "topology");
  } catch (error) {
    throw inputError(`Input topology is invalid: ${errorMessage(error)}`, error);
  }
}

function inputError(message: string, cause?: unknown): TopologyMoveError {
  return cause === undefined
    ? new TopologyMoveError("input", message)
    : new TopologyMoveError("input", message, { cause });
}

function candidateError(stage: "candidateTopology" | "candidateFaces", error: unknown): TopologyMoveError {
  return new TopologyMoveError(stage, `Topology move rejected during ${stage}: ${errorMessage(error)}`, { cause: error });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
