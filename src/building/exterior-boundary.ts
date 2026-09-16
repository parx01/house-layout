import { extractBoundedFaces } from "../spaces/extract-faces.js";
import type { DerivedFaceVertex, DirectedWallHalfEdgeRef, FaceId } from "../spaces/model.js";
import type { NodeId, TopologyV2, WallId } from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";

export class ExteriorBoundaryDerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExteriorBoundaryDerivationError";
  }
}

export interface DerivedExteriorBoundaryLoop {
  readonly winding: "clockwise";
  readonly boundary: readonly DirectedWallHalfEdgeRef[];
  readonly vertices: readonly DerivedFaceVertex[];
}

export interface DerivedExteriorBoundaryV1 {
  readonly modelVersion: 1;
  readonly topologyModelVersion: 1;
  /** Walls separating one bounded face from the unbounded exterior. */
  readonly exteriorWallIds: readonly WallId[];
  /** Walls used by two bounded faces, independent of semantic room meaning. */
  readonly internalSharedWallIds: readonly WallId[];
  /** Bridges/dangling walls that do not bound any face. */
  readonly nonFaceBoundaryWallIds: readonly WallId[];
  readonly loops: readonly DerivedExteriorBoundaryLoop[];
}

interface ExteriorHalfEdge extends DirectedWallHalfEdgeRef {
  readonly key: string;
  readonly faceId: FaceId;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
}

/**
 * Purely derives the building-to-unbounded-plane boundary from canonical
 * topology and A2.4 face incidence. No semantic or legacy geometry is read.
 */
export function deriveExteriorBoundary(topologyValue: TopologyV2): DerivedExteriorBoundaryV1 {
  const topology = validateTopologyV2(topologyValue, "exteriorBoundary.topology");
  const faceSet = extractBoundedFaces(topology);
  const incidences = new Map<WallId, ExteriorHalfEdge[]>();
  for (const face of faceSet.faces) {
    for (let index = 0; index < face.boundary.length; index += 1) {
      const reference = face.boundary[index]!;
      const start = face.vertices[index]!;
      const end = face.vertices[(index + 1) % face.vertices.length]!;
      const values = incidences.get(reference.wallId) ?? [];
      values.push({
        ...reference,
        key: halfEdgeKey(reference),
        faceId: face.id,
        startNodeId: start.nodeId,
        endNodeId: end.nodeId,
      });
      incidences.set(reference.wallId, values);
    }
  }

  const exteriorEdges: ExteriorHalfEdge[] = [];
  const exteriorWallIds: WallId[] = [];
  const internalSharedWallIds: WallId[] = [];
  const nonFaceBoundaryWallIds: WallId[] = [];
  for (const wallIdentity of Object.keys(topology.walls).sort() as WallId[]) {
    const uses = incidences.get(wallIdentity) ?? [];
    if (uses.length === 0) {
      nonFaceBoundaryWallIds.push(wallIdentity);
      continue;
    }
    if (uses.length === 1) {
      exteriorWallIds.push(wallIdentity);
      exteriorEdges.push(uses[0]!);
      continue;
    }
    if (uses.length === 2) {
      if (uses[0]!.direction === uses[1]!.direction) {
        throw new ExteriorBoundaryDerivationError(
          `Internal wall ${wallIdentity} is not used in opposite directions by its bounded faces.`,
        );
      }
      internalSharedWallIds.push(wallIdentity);
      continue;
    }
    throw new ExteriorBoundaryDerivationError(
      `Canonical wall ${wallIdentity} is incident to more than two bounded faces.`,
    );
  }

  return {
    modelVersion: 1,
    topologyModelVersion: 1,
    exteriorWallIds,
    internalSharedWallIds,
    nonFaceBoundaryWallIds,
    loops: assembleExteriorLoops(topology, exteriorEdges),
  };
}

function assembleExteriorLoops(
  topology: TopologyV2,
  edges: readonly ExteriorHalfEdge[],
): readonly DerivedExteriorBoundaryLoop[] {
  const outgoing = new Map<NodeId, ExteriorHalfEdge[]>();
  const incoming = new Map<NodeId, ExteriorHalfEdge[]>();
  for (const edge of edges) {
    const outgoingValues = outgoing.get(edge.startNodeId) ?? [];
    outgoingValues.push(edge);
    outgoing.set(edge.startNodeId, outgoingValues);
    const incomingValues = incoming.get(edge.endNodeId) ?? [];
    incomingValues.push(edge);
    incoming.set(edge.endNodeId, incomingValues);
  }
  const boundaryNodeIds = new Set([...outgoing.keys(), ...incoming.keys()]);
  for (const nodeIdentity of [...boundaryNodeIds].sort()) {
    const outgoingCount = outgoing.get(nodeIdentity)?.length ?? 0;
    const incomingCount = incoming.get(nodeIdentity)?.length ?? 0;
    if (outgoingCount !== 1 || incomingCount !== 1) {
      throw new ExteriorBoundaryDerivationError(
        `Exterior boundary is non-manifold at node ${nodeIdentity}: ${incomingCount} incoming, ${outgoingCount} outgoing.`,
      );
    }
  }

  const byKey = new Map(edges.map((edge) => [edge.key, edge]));
  const visited = new Set<string>();
  const loops: Array<{ signature: string; loop: DerivedExteriorBoundaryLoop }> = [];
  for (const initial of [...edges].sort(compareEdges)) {
    if (visited.has(initial.key)) continue;
    const walk: ExteriorHalfEdge[] = [];
    let current = initial;
    while (!visited.has(current.key)) {
      visited.add(current.key);
      walk.push(current);
      const next = outgoing.get(current.endNodeId)?.[0];
      if (!next || !byKey.has(next.key)) {
        throw new ExteriorBoundaryDerivationError(`Exterior half-edge ${current.key} does not continue to a closed loop.`);
      }
      current = next;
    }
    if (current.key !== initial.key) {
      throw new ExteriorBoundaryDerivationError(`Exterior walk beginning ${initial.key} merged into another loop.`);
    }
    const canonical = rotateToCanonicalStart(walk);
    const signature = canonical.map((edge) => edge.key).join("|");
    loops.push({
      signature,
      loop: {
        winding: "clockwise",
        boundary: canonical.map(({ wallId, direction }) => ({ wallId, direction })),
        vertices: canonical.map((edge) => {
          const node = topology.nodes[edge.startNodeId]!;
          return { nodeId: node.id, xUm: node.xUm, yUm: node.yUm };
        }),
      },
    });
  }
  if (visited.size !== edges.length) {
    throw new ExteriorBoundaryDerivationError("Not every exterior half-edge was assigned to a boundary loop.");
  }
  return loops.sort((left, right) => left.signature.localeCompare(right.signature)).map(({ loop }) => loop);
}

function rotateToCanonicalStart(edges: readonly ExteriorHalfEdge[]): ExteriorHalfEdge[] {
  let bestIndex = 0;
  for (let index = 1; index < edges.length; index += 1) {
    if (edges[index]!.key.localeCompare(edges[bestIndex]!.key) < 0) bestIndex = index;
  }
  return [...edges.slice(bestIndex), ...edges.slice(0, bestIndex)];
}

function halfEdgeKey(reference: DirectedWallHalfEdgeRef): string {
  return `${reference.wallId}:${reference.direction === "forward" ? "f" : "r"}`;
}

function compareEdges(left: ExteriorHalfEdge, right: ExteriorHalfEdge): number {
  return left.key.localeCompare(right.key);
}
