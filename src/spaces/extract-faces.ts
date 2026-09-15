import { areaUm2 } from "../core/units.js";
import {
  wallId,
  type NodeId,
  type TopologyV2,
  type WallId,
} from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";
import {
  faceId,
  type DerivedBoundedFace,
  type DerivedFaceVertex,
  type DerivedFaceSetV1,
  type DirectedWallHalfEdgeRef,
} from "./model.js";

export class FaceExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceExtractionError";
  }
}

interface HalfEdge extends DirectedWallHalfEdgeRef {
  readonly key: string;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
}

interface FaceCandidate {
  readonly signature: string;
  readonly face: DerivedBoundedFace;
}

/**
 * Derives bounded planar faces from canonical wall centre-lines. Nothing is
 * persisted: topology remains the only geometric source of truth.
 */
export function extractBoundedFaces(topologyValue: TopologyV2): DerivedFaceSetV1 {
  const topology = validateTopologyV2(topologyValue, "topology");
  const bridgeWallIds = findBridgeWallIds(topology);
  const halfEdges = createHalfEdges(topology, bridgeWallIds);
  const outgoing = indexOutgoingHalfEdges(topology, halfEdges);
  const successors = createSuccessorMap(outgoing, halfEdges);
  const visited = new Set<string>();
  const candidates: FaceCandidate[] = [];
  let excludedExteriorWalkCount = 0;

  for (const start of [...halfEdges.values()].sort((left, right) => left.key.localeCompare(right.key))) {
    if (visited.has(start.key)) continue;
    const walk = traceWalk(start, halfEdges, successors, visited);
    const signedDoubleArea = calculateSignedDoubleArea(topology, walk);
    if (signedDoubleArea === 0n) {
      throw new FaceExtractionError(`Half-edge walk beginning ${start.key} has zero area.`);
    }
    if (signedDoubleArea < 0n) {
      excludedExteriorWalkCount += 1;
      continue;
    }
    candidates.push(createFaceCandidate(topology, walk, signedDoubleArea));
  }

  assertNoOverlappingFaceInteriors(candidates.map((candidate) => candidate.face));
  const signaturesById = new Map<string, string>();
  for (const candidate of candidates) {
    const existing = signaturesById.get(candidate.face.id);
    if (existing && existing !== candidate.signature) {
      throw new FaceExtractionError(`Derived face ID collision for ${candidate.face.id}.`);
    }
    signaturesById.set(candidate.face.id, candidate.signature);
  }

  return {
    modelVersion: 1,
    topologyModelVersion: 1,
    faces: candidates.map((candidate) => candidate.face).sort((left, right) => left.id.localeCompare(right.id)),
    ignoredBridgeWallIds: [...bridgeWallIds].sort().map(wallId),
    excludedExteriorWalkCount,
  };
}

function findBridgeWallIds(topology: TopologyV2): Set<string> {
  const adjacency = new Map<NodeId, Array<{ nodeId: NodeId; wallId: WallId }>>();
  for (const node of Object.values(topology.nodes)) adjacency.set(node.id, []);
  for (const wall of Object.values(topology.walls)) {
    adjacency.get(wall.startNodeId)!.push({ nodeId: wall.endNodeId, wallId: wall.id });
    adjacency.get(wall.endNodeId)!.push({ nodeId: wall.startNodeId, wallId: wall.id });
  }
  for (const edges of adjacency.values()) edges.sort((left, right) => left.wallId.localeCompare(right.wallId));

  const discovery = new Map<NodeId, number>();
  const low = new Map<NodeId, number>();
  const bridges = new Set<string>();
  let time = 0;

  const visit = (nodeIdentity: NodeId, parentWallId: WallId | null): void => {
    const discoveredAt = ++time;
    discovery.set(nodeIdentity, discoveredAt);
    low.set(nodeIdentity, discoveredAt);
    for (const edge of adjacency.get(nodeIdentity)!) {
      if (edge.wallId === parentWallId) continue;
      const neighbourDiscovery = discovery.get(edge.nodeId);
      if (neighbourDiscovery === undefined) {
        visit(edge.nodeId, edge.wallId);
        low.set(nodeIdentity, Math.min(low.get(nodeIdentity)!, low.get(edge.nodeId)!));
        if (low.get(edge.nodeId)! > discoveredAt) bridges.add(edge.wallId);
      } else {
        low.set(nodeIdentity, Math.min(low.get(nodeIdentity)!, neighbourDiscovery));
      }
    }
  };

  for (const nodeIdValue of Object.keys(topology.nodes).sort().map((value) => value as NodeId)) {
    if (!discovery.has(nodeIdValue)) visit(nodeIdValue, null);
  }
  return bridges;
}

function createHalfEdges(topology: TopologyV2, bridges: Set<string>): Map<string, HalfEdge> {
  const result = new Map<string, HalfEdge>();
  for (const wallIdValue of Object.keys(topology.walls).sort().map(wallId)) {
    if (bridges.has(wallIdValue)) continue;
    const wall = topology.walls[wallIdValue]!;
    const forward = halfEdge(wall.id, "forward", wall.startNodeId, wall.endNodeId);
    const reverse = halfEdge(wall.id, "reverse", wall.endNodeId, wall.startNodeId);
    result.set(forward.key, forward);
    result.set(reverse.key, reverse);
  }
  return result;
}

function halfEdge(
  wallIdValue: WallId,
  direction: "forward" | "reverse",
  startNodeId: NodeId,
  endNodeId: NodeId,
): HalfEdge {
  return { key: halfEdgeKey(wallIdValue, direction), wallId: wallIdValue, direction, startNodeId, endNodeId };
}

function halfEdgeKey(wallIdValue: WallId, direction: "forward" | "reverse"): string {
  return `${wallIdValue}:${direction === "forward" ? "f" : "r"}`;
}

function twinKey(edge: HalfEdge): string {
  return halfEdgeKey(edge.wallId, edge.direction === "forward" ? "reverse" : "forward");
}

function indexOutgoingHalfEdges(topology: TopologyV2, halfEdges: Map<string, HalfEdge>): Map<NodeId, HalfEdge[]> {
  const outgoing = new Map<NodeId, HalfEdge[]>();
  for (const edge of halfEdges.values()) {
    const values = outgoing.get(edge.startNodeId) ?? [];
    values.push(edge);
    outgoing.set(edge.startNodeId, values);
  }
  for (const values of outgoing.values()) {
    values.sort((left, right) => {
      const rankDifference = directionRank(topology, left) - directionRank(topology, right);
      return rankDifference || left.key.localeCompare(right.key);
    });
  }
  return outgoing;
}

function directionRank(topology: TopologyV2, edge: HalfEdge): number {
  const start = topology.nodes[edge.startNodeId]!;
  const end = topology.nodes[edge.endNodeId]!;
  if (end.xUm > start.xUm) return 0; // east
  if (end.yUm > start.yUm) return 1; // south in the ProjectV2/SVG coordinate frame
  if (end.xUm < start.xUm) return 2; // west
  return 3; // north
}

function createSuccessorMap(outgoing: Map<NodeId, HalfEdge[]>, halfEdges: Map<string, HalfEdge>): Map<string, string> {
  const result = new Map<string, string>();
  for (const edge of halfEdges.values()) {
    const atDestination = outgoing.get(edge.endNodeId);
    if (!atDestination?.length) throw new FaceExtractionError(`No outgoing half-edge at node ${edge.endNodeId}.`);
    const incomingTwinIndex = atDestination.findIndex((candidate) => candidate.key === twinKey(edge));
    if (incomingTwinIndex < 0) throw new FaceExtractionError(`Missing twin half-edge for ${edge.key}.`);
    const nextIndex = (incomingTwinIndex - 1 + atDestination.length) % atDestination.length;
    result.set(edge.key, atDestination[nextIndex]!.key);
  }
  return result;
}

function traceWalk(
  start: HalfEdge,
  halfEdges: Map<string, HalfEdge>,
  successors: Map<string, string>,
  visited: Set<string>,
): HalfEdge[] {
  const walk: HalfEdge[] = [];
  const local = new Set<string>();
  let current = start;
  while (true) {
    if (local.has(current.key)) {
      if (current.key !== start.key) throw new FaceExtractionError(`Half-edge walk merged into a cycle at ${current.key}.`);
      break;
    }
    if (visited.has(current.key)) throw new FaceExtractionError(`Half-edge ${current.key} belongs to multiple face walks.`);
    local.add(current.key);
    visited.add(current.key);
    walk.push(current);
    const nextKey = successors.get(current.key);
    const next = nextKey ? halfEdges.get(nextKey) : undefined;
    if (!next) throw new FaceExtractionError(`Half-edge ${current.key} has no valid successor.`);
    current = next;
    if (walk.length > halfEdges.size) throw new FaceExtractionError("Half-edge traversal did not terminate.");
  }
  return walk;
}

function calculateSignedDoubleArea(topology: TopologyV2, walk: readonly HalfEdge[]): bigint {
  let result = 0n;
  for (const edge of walk) {
    const start = topology.nodes[edge.startNodeId]!;
    const end = topology.nodes[edge.endNodeId]!;
    result += BigInt(start.xUm) * BigInt(end.yUm) - BigInt(end.xUm) * BigInt(start.yUm);
  }
  return result;
}

function createFaceCandidate(topology: TopologyV2, walk: readonly HalfEdge[], signedDoubleArea: bigint): FaceCandidate {
  if (signedDoubleArea % 2n !== 0n) {
    throw new FaceExtractionError(`Bounded walk ${walk[0]!.key} has a half-square-micrometre area.`);
  }
  const exactArea = signedDoubleArea / 2n;
  if (exactArea > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new FaceExtractionError(`Bounded walk ${walk[0]!.key} area exceeds the safe integer range.`);
  }
  const rotated = rotateToCanonicalStart(walk);
  const signature = rotated.map((edge) => edge.key).join("|");
  const vertices = rotated.map((edge) => {
    const node = topology.nodes[edge.startNodeId]!;
    return { nodeId: node.id, xUm: node.xUm, yUm: node.yUm };
  });
  assertSimpleBoundary(vertices, signature);
  return {
    signature,
    face: {
      id: faceId(`f-${fnv1a64(signature)}`),
      winding: "clockwise",
      boundary: rotated.map((edge) => ({ wallId: edge.wallId, direction: edge.direction })),
      vertices,
      areaUm2: areaUm2(Number(exactArea), `derived face ${signature} area`),
    },
  };
}

function rotateToCanonicalStart(walk: readonly HalfEdge[]): HalfEdge[] {
  let bestIndex = 0;
  for (let index = 1; index < walk.length; index += 1) {
    if (walk[index]!.key.localeCompare(walk[bestIndex]!.key) < 0) bestIndex = index;
  }
  return [...walk.slice(bestIndex), ...walk.slice(0, bestIndex)];
}

function assertSimpleBoundary(vertices: readonly DerivedFaceVertex[], signature: string): void {
  if (vertices.length < 4) throw new FaceExtractionError(`Bounded face ${signature} has fewer than four orthogonal edges.`);
  const seen = new Set<string>();
  for (const vertex of vertices) {
    if (seen.has(vertex.nodeId)) throw new FaceExtractionError(`Bounded face ${signature} repeats node ${vertex.nodeId}.`);
    seen.add(vertex.nodeId);
  }
}

function assertNoOverlappingFaceInteriors(faces: readonly DerivedBoundedFace[]): void {
  for (let leftIndex = 0; leftIndex < faces.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < faces.length; rightIndex += 1) {
      const left = faces[leftIndex]!;
      const right = faces[rightIndex]!;
      if (pointStrictlyInsidePolygon(interiorSample(left.vertices), right.vertices) ||
        pointStrictlyInsidePolygon(interiorSample(right.vertices), left.vertices)) {
        throw new FaceExtractionError(
          `Derived faces ${left.id} and ${right.id} have overlapping interiors; nested disconnected cycles require explicit hole support.`,
        );
      }
    }
  }
}

interface DoubledPoint { readonly x2: number; readonly y2: number }

function interiorSample(vertices: readonly DerivedFaceVertex[]): DoubledPoint {
  const start = vertices[0]!;
  const end = vertices[1]!;
  const dx = Math.sign(end.xUm - start.xUm);
  const dy = Math.sign(end.yUm - start.yUm);
  return { x2: start.xUm + end.xUm - dy, y2: start.yUm + end.yUm + dx };
}

function pointStrictlyInsidePolygon(point: DoubledPoint, vertices: readonly DerivedFaceVertex[]): boolean {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const currentVertex = vertices[index]!;
    const previousVertex = vertices[previous]!;
    const currentY2 = currentVertex.yUm * 2;
    const previousY2 = previousVertex.yUm * 2;
    if ((currentY2 > point.y2) === (previousY2 > point.y2)) continue;
    const intersectionX2 = (previousVertex.xUm * 2) +
      ((point.y2 - previousY2) * (currentVertex.xUm - previousVertex.xUm) * 2) / (currentY2 - previousY2);
    if (point.x2 < intersectionX2) inside = !inside;
  }
  return inside;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
