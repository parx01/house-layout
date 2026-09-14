import { coordinateUm, positiveLengthUm, type CoordinateUm, type LengthUm } from "../core/units.js";
import {
  getConnectedWallIds,
  getWallEndNode,
  getWallOrientation,
  getWallStartNode,
  nodeId,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
  type WallOrientation,
} from "./model.js";
import { validateTopologyV2 } from "./validation.js";

export interface TopologyPoint {
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
}

export interface WallProposal {
  readonly start: TopologyPoint;
  readonly end: TopologyPoint;
  readonly thicknessUm: LengthUm;
}

export type PointIntersectionKind =
  | "endpointEndpoint"
  | "proposedEndpointToExistingInterior"
  | "existingEndpointToProposedInterior"
  | "interiorCrossing";

export interface PointWallIntersection {
  readonly kind: PointIntersectionKind;
  readonly wallId: WallId;
  readonly point: TopologyPoint;
}

export interface CollinearWallConflict {
  readonly kind: "exactDuplicate" | "collinearOverlap";
  readonly wallId: WallId;
}

export type WallIntersection = PointWallIntersection | CollinearWallConflict;

export interface TopologyOperationOptions {
  /** Stable caller-controlled token used to derive any required n-/w- IDs. */
  readonly idSeed: string;
}

export interface TopologyChangeResult {
  readonly topology: TopologyV2;
  readonly createdNodeIds: NodeId[];
  readonly createdWallIds: WallId[];
  readonly removedWallIds: WallId[];
  readonly insertedWallIds: WallId[];
  readonly wallReplacements: Record<string, WallId[]>;
}

export class TopologyOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopologyOperationError";
  }
}

export function findNodeAtCoordinate(
  topology: TopologyV2,
  point: TopologyPoint,
): TopologyNode | undefined {
  return Object.values(topology.nodes).find((node) => node.xUm === point.xUm && node.yUm === point.yUm);
}

export function getWallsAtNode(topology: TopologyV2, id: NodeId): TopologyWall[] {
  return getConnectedWallIds(topology, id).map((wallIdentity) => topology.walls[wallIdentity]!);
}

export function findWallIntersections(
  topologyValue: TopologyV2,
  proposalValue: WallProposal,
): WallIntersection[] {
  const topology = validateTopologyV2(topologyValue);
  const proposal = validateProposal(proposalValue);
  const proposalOrientation = proposalAxis(proposal);
  const intersections: WallIntersection[] = [];

  for (const existingWallId of sortedWallIds(topology)) {
    const existingOrientation = getWallOrientation(topology, existingWallId);
    const existingStart = getWallStartNode(topology, existingWallId);
    const existingEnd = getWallEndNode(topology, existingWallId);

    if (proposalOrientation === existingOrientation) {
      const conflict = classifyCollinearRelationship(proposal, existingStart, existingEnd, existingOrientation);
      if (conflict === "none") continue;
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
    if (!point) continue;
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

export function splitWallAtPoint(
  topologyValue: TopologyV2,
  wallIdentity: WallId,
  pointValue: TopologyPoint,
  options: TopologyOperationOptions,
): TopologyChangeResult {
  const topology = validateTopologyV2(topologyValue);
  const point = validatePoint(pointValue, "split point");
  const wall = topology.walls[wallIdentity];
  if (!wall) throw new TopologyOperationError(`Topology wall ${wallIdentity} does not exist.`);
  const start = getWallStartNode(topology, wallIdentity);
  const end = getWallEndNode(topology, wallIdentity);
  if (!pointOnSegment(point, start, end)) {
    throw new TopologyOperationError(`Split point is not on topology wall ${wallIdentity}.`);
  }
  if (pointsEqual(point, start) || pointsEqual(point, end)) return unchangedResult(topology);

  const candidate = mutableClone(topology);
  const allocator = createIdAllocator(candidate, options.idSeed);
  const createdNodeIds: NodeId[] = [];
  const splitNodeId = findNodeAtCoordinate(candidate, point)?.id ?? createNode(candidate, point, allocator, createdNodeIds);
  const createdWallIds: WallId[] = [];
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

export function insertWall(
  topologyValue: TopologyV2,
  proposalValue: WallProposal,
  options: TopologyOperationOptions,
): TopologyChangeResult {
  const topology = validateTopologyV2(topologyValue);
  const proposal = validateProposal(proposalValue);
  const intersections = findWallIntersections(topology, proposal);
  const conflict = intersections.find(
    (intersection): intersection is CollinearWallConflict =>
      intersection.kind === "exactDuplicate" || intersection.kind === "collinearOverlap",
  );
  if (conflict) {
    throw new TopologyOperationError(
      conflict.kind === "exactDuplicate"
        ? `Proposed wall duplicates topology wall ${conflict.wallId}.`
        : `Proposed wall overlaps collinearly with topology wall ${conflict.wallId}.`,
    );
  }

  const candidate = mutableClone(topology);
  const allocator = createIdAllocator(candidate, options.idSeed);
  const createdNodeIds: NodeId[] = [];
  const createdWallIds: WallId[] = [];
  const removedWallIds: WallId[] = [];
  const wallReplacements: Record<string, WallId[]> = {};

  const canonicalPoints = uniqueSortedPoints([
    proposal.start,
    proposal.end,
    ...intersections
      .filter((intersection): intersection is PointWallIntersection => "point" in intersection)
      .map((intersection) => intersection.point),
    ...Object.values(topology.nodes)
      .filter((node) => pointOnSegment(node, proposal.start, proposal.end))
      .map((node) => ({ xUm: node.xUm, yUm: node.yUm })),
  ]);

  const nodeIdsByCoordinate = new Map<string, NodeId>();
  for (const point of canonicalPoints) {
    const existingNode = findNodeAtCoordinate(candidate, point);
    const id = existingNode?.id ?? createNode(candidate, point, allocator, createdNodeIds);
    nodeIdsByCoordinate.set(pointKey(point), id);
  }

  const splitPointsByWall = new Map<WallId, TopologyPoint[]>();
  for (const intersection of intersections) {
    if (!("point" in intersection)) continue;
    const existingStart = getWallStartNode(topology, intersection.wallId);
    const existingEnd = getWallEndNode(topology, intersection.wallId);
    if (pointsEqual(intersection.point, existingStart) || pointsEqual(intersection.point, existingEnd)) continue;
    const points = splitPointsByWall.get(intersection.wallId) ?? [];
    points.push(intersection.point);
    splitPointsByWall.set(intersection.wallId, points);
  }

  for (const existingWallId of [...splitPointsByWall.keys()].sort()) {
    const wall = candidate.walls[existingWallId]!;
    const splitNodeIds = uniqueSortedPoints(splitPointsByWall.get(existingWallId)!).map((point) =>
      nodeIdsByCoordinate.get(pointKey(point))!,
    );
    const replacements = replaceWallWithSegments(candidate, wall, splitNodeIds, allocator, createdWallIds);
    removedWallIds.push(existingWallId);
    wallReplacements[existingWallId] = replacements;
  }

  const insertedNodeIds = canonicalPoints.map((point) => nodeIdsByCoordinate.get(pointKey(point))!);
  const insertedWallIds = createSegmentsForNodePath(
    candidate,
    { thicknessUm: proposal.thicknessUm },
    insertedNodeIds,
    allocator,
    createdWallIds,
  );
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

function replaceWallWithSegments(
  topology: MutableTopology,
  wall: TopologyWall,
  splitNodeIds: NodeId[],
  allocator: IdAllocator,
  createdWallIds: WallId[],
): WallId[] {
  delete topology.walls[wall.id];
  return createSegmentsForNodePath(
    topology,
    wall,
    [wall.startNodeId, ...splitNodeIds, wall.endNodeId],
    allocator,
    createdWallIds,
  );
}

function createSegmentsForNodePath(
  topology: MutableTopology,
  wallData: Pick<TopologyWall, "thicknessUm">,
  nodeIds: NodeId[],
  allocator: IdAllocator,
  createdWallIds: WallId[],
): WallId[] {
  const sortedNodeIds = [...new Set(nodeIds)].sort((leftId, rightId) =>
    comparePoints(topology.nodes[leftId]!, topology.nodes[rightId]!),
  );
  const result: WallId[] = [];
  for (let index = 0; index < sortedNodeIds.length - 1; index += 1) {
    const startNodeId = sortedNodeIds[index]!;
    const endNodeId = sortedNodeIds[index + 1]!;
    const id = allocator.nextWallId();
    topology.walls[id] = { id, startNodeId, endNodeId, thicknessUm: wallData.thicknessUm };
    createdWallIds.push(id);
    result.push(id);
  }
  return result;
}

function createNode(
  topology: MutableTopology,
  point: TopologyPoint,
  allocator: IdAllocator,
  createdNodeIds: NodeId[],
): NodeId {
  const id = allocator.nextNodeId();
  topology.nodes[id] = { id, xUm: point.xUm, yUm: point.yUm };
  createdNodeIds.push(id);
  return id;
}

function classifyCollinearRelationship(
  proposal: WallProposal,
  existingStart: TopologyPoint,
  existingEnd: TopologyPoint,
  orientation: WallOrientation,
): "none" | "exactDuplicate" | "collinearOverlap" | TopologyPoint {
  const sameLine = orientation === "horizontal"
    ? proposal.start.yUm === existingStart.yUm
    : proposal.start.xUm === existingStart.xUm;
  if (!sameLine) return "none";
  const proposalRange = coordinateRange(proposal.start, proposal.end, orientation);
  const existingRange = coordinateRange(existingStart, existingEnd, orientation);
  const overlapStart = Math.max(proposalRange.min, existingRange.min);
  const overlapEnd = Math.min(proposalRange.max, existingRange.max);
  if (overlapStart > overlapEnd) return "none";
  if (overlapStart < overlapEnd) {
    const sameRange = proposalRange.min === existingRange.min && proposalRange.max === existingRange.max;
    return sameRange ? "exactDuplicate" : "collinearOverlap";
  }
  return orientation === "horizontal"
    ? point(coordinateUm(overlapStart), proposal.start.yUm)
    : point(proposal.start.xUm, coordinateUm(overlapStart));
}

function perpendicularIntersection(
  proposal: WallProposal,
  existingStart: TopologyPoint,
  existingEnd: TopologyPoint,
  proposalOrientation: WallOrientation,
): TopologyPoint | null {
  const candidate = proposalOrientation === "horizontal"
    ? point(existingStart.xUm, proposal.start.yUm)
    : point(proposal.start.xUm, existingStart.yUm);
  return pointOnSegment(candidate, proposal.start, proposal.end) && pointOnSegment(candidate, existingStart, existingEnd)
    ? candidate
    : null;
}

function validateProposal(value: WallProposal): WallProposal {
  const start = validatePoint(value.start, "proposed wall start");
  const end = validatePoint(value.end, "proposed wall end");
  const thickness = value.thicknessUm;
  if (!Number.isSafeInteger(thickness) || thickness <= 0) {
    throw new TopologyOperationError("Proposed wall thicknessUm must be a positive safe integer.");
  }
  if (pointsEqual(start, end)) throw new TopologyOperationError("Proposed wall must not be zero-length.");
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

function validatePoint(value: TopologyPoint, label: string): TopologyPoint {
  if (!value || typeof value !== "object") throw new TopologyOperationError(`${label} must be an object.`);
  if (!Number.isSafeInteger(value.xUm) || !Number.isSafeInteger(value.yUm)) {
    throw new TopologyOperationError(`${label} coordinates must be safe integers.`);
  }
  return { xUm: coordinateUm(value.xUm), yUm: coordinateUm(value.yUm) };
}

function proposalAxis(proposal: WallProposal): WallOrientation {
  return proposal.start.yUm === proposal.end.yUm ? "horizontal" : "vertical";
}

function pointOnSegment(pointValue: TopologyPoint, start: TopologyPoint, end: TopologyPoint): boolean {
  if (start.xUm === end.xUm) {
    return pointValue.xUm === start.xUm && between(pointValue.yUm, start.yUm, end.yUm);
  }
  if (start.yUm === end.yUm) {
    return pointValue.yUm === start.yUm && between(pointValue.xUm, start.xUm, end.xUm);
  }
  return false;
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) && value <= Math.max(a, b);
}

function coordinateRange(start: TopologyPoint, end: TopologyPoint, orientation: WallOrientation) {
  const startValue = orientation === "horizontal" ? start.xUm : start.yUm;
  const endValue = orientation === "horizontal" ? end.xUm : end.yUm;
  return { min: Math.min(startValue, endValue), max: Math.max(startValue, endValue) };
}

function uniqueSortedPoints(points: TopologyPoint[]): TopologyPoint[] {
  const unique = new Map<string, TopologyPoint>();
  for (const value of points) unique.set(pointKey(value), value);
  return [...unique.values()].sort(comparePoints);
}

function comparePoints(left: TopologyPoint, right: TopologyPoint): number {
  if (left.xUm !== right.xUm) return left.xUm < right.xUm ? -1 : 1;
  if (left.yUm !== right.yUm) return left.yUm < right.yUm ? -1 : 1;
  return 0;
}

function pointsEqual(left: TopologyPoint, right: TopologyPoint): boolean {
  return left.xUm === right.xUm && left.yUm === right.yUm;
}

function pointKey(value: TopologyPoint): string {
  return `${value.xUm},${value.yUm}`;
}

function point(xUm: CoordinateUm, yUm: CoordinateUm): TopologyPoint {
  return { xUm, yUm };
}

function sortedWallIds(topology: TopologyV2): WallId[] {
  return Object.keys(topology.walls).sort().map(wallId);
}

interface MutableTopology {
  status: "empty" | "active";
  modelVersion: 1;
  nodes: Record<NodeId, TopologyNode>;
  walls: Record<WallId, TopologyWall>;
}

function mutableClone(topology: TopologyV2): MutableTopology {
  return {
    status: topology.status,
    modelVersion: 1,
    nodes: Object.fromEntries(Object.entries(topology.nodes).map(([id, value]) => [id, { ...value }])) as Record<NodeId, TopologyNode>,
    walls: Object.fromEntries(Object.entries(topology.walls).map(([id, value]) => [id, { ...value }])) as Record<WallId, TopologyWall>,
  };
}

interface IdAllocator {
  nextNodeId(): NodeId;
  nextWallId(): WallId;
}

function createIdAllocator(topology: TopologyV2, seedValue: string): IdAllocator {
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

function unchangedResult(topology: TopologyV2): TopologyChangeResult {
  return {
    topology,
    createdNodeIds: [],
    createdWallIds: [],
    removedWallIds: [],
    insertedWallIds: [],
    wallReplacements: {},
  };
}
