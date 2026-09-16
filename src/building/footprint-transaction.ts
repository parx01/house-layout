import { deriveExteriorBoundary } from "./exterior-boundary.js";
import {
  derivePhysicalExteriorEnvelope,
  physicalExteriorEnvelopeGeometryEquals,
  type DerivedPhysicalExteriorEnvelopeV1,
} from "./physical-exterior-envelope.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import type { NodeId, TopologyV2, WallId } from "../topology/model.js";
import type { TopologyMoveMetadata, TopologyMoveResult } from "../topology/movement.js";
import { validateTopologyV2 } from "../topology/validation.js";

export interface AffectedWallClassifications {
  readonly exteriorWallIds: readonly WallId[];
  readonly internalSharedWallIds: readonly WallId[];
  readonly nonFaceBoundaryWallIds: readonly WallId[];
}

export type FootprintMoveTransactionResult =
  | {
      readonly status: "committed";
      readonly committedTopology: TopologyV2;
      readonly movementMetadata: TopologyMoveMetadata;
      readonly affectedNodeIds: readonly NodeId[];
      readonly affectedWallIds: readonly WallId[];
      readonly involvedWallClassifications: AffectedWallClassifications;
      readonly beforeEnvelope: DerivedPhysicalExteriorEnvelopeV1;
      readonly afterEnvelope: DerivedPhysicalExteriorEnvelopeV1;
      readonly footprintChanged: boolean;
    }
  | {
      readonly status: "rejected";
      readonly reason: string;
      readonly errorName: string;
      readonly affectedNodeIds: readonly [];
      readonly affectedWallIds: readonly [];
      readonly involvedWallClassifications: AffectedWallClassifications;
      readonly beforeEnvelope: DerivedPhysicalExteriorEnvelopeV1;
      /** The committed post-state is unchanged; no invalid candidate envelope is exposed. */
      readonly afterEnvelope: DerivedPhysicalExteriorEnvelopeV1;
      readonly footprintChanged: false;
    };

/**
 * Runs an existing A2.5 movement and derives its footprint consequences.
 * Geometry remains owned by A2.5; this function only validates and reports the
 * candidate transaction. Rejections never expose a topology to commit.
 */
export function evaluateFootprintMoveTransaction(
  topologyValue: TopologyV2,
  movement: (topology: TopologyV2) => TopologyMoveResult,
): FootprintMoveTransactionResult {
  const before = validateTopologyV2(topologyValue, "footprintTransaction.topology");
  const beforeEnvelope = derivePhysicalExteriorEnvelope(before);
  try {
    const result = movement(structuredClone(before));
    if (!result || typeof result !== "object" || !result.metadata || !result.topology) {
      throw new TypeError("A2.5 movement did not return topology and metadata.");
    }
    const after = validateTopologyV2(result.topology, "footprintTransaction.candidateTopology");
    assertSameCanonicalEntities(before, after);
    assertFacesPreserved(before, after);
    const affectedNodeIds = deriveAffectedNodeIds(before, after);
    const affectedWallIds = deriveAffectedWallIds(before, affectedNodeIds);
    assertMetadataMatches(result.metadata, before, after, affectedNodeIds, affectedWallIds);

    const beforeBoundary = deriveExteriorBoundary(before);
    const afterBoundary = deriveExteriorBoundary(after);
    assertClassificationsPreserved(beforeBoundary, afterBoundary);
    const afterEnvelope = derivePhysicalExteriorEnvelope(after);
    return {
      status: "committed",
      committedTopology: after,
      movementMetadata: structuredClone(result.metadata),
      affectedNodeIds,
      affectedWallIds,
      involvedWallClassifications: classifyAffectedWalls(affectedWallIds, beforeBoundary),
      beforeEnvelope,
      afterEnvelope,
      footprintChanged: !physicalExteriorEnvelopeGeometryEquals(beforeEnvelope, afterEnvelope),
    };
  } catch (error) {
    return {
      status: "rejected",
      reason: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : "UnknownError",
      affectedNodeIds: [],
      affectedWallIds: [],
      involvedWallClassifications: emptyClassifications(),
      beforeEnvelope,
      afterEnvelope: beforeEnvelope,
      footprintChanged: false,
    };
  }
}

function assertSameCanonicalEntities(before: TopologyV2, after: TopologyV2): void {
  const beforeNodeIds = Object.keys(before.nodes).sort();
  const afterNodeIds = Object.keys(after.nodes).sort();
  const beforeWallIds = Object.keys(before.walls).sort();
  const afterWallIds = Object.keys(after.walls).sort();
  if (!equalStrings(beforeNodeIds, afterNodeIds) || !equalStrings(beforeWallIds, afterWallIds)) {
    throw new Error("A2.5 movement must preserve every canonical node and wall ID.");
  }
  for (const identity of beforeWallIds as WallId[]) {
    const previous = before.walls[identity]!;
    const candidate = after.walls[identity]!;
    if (
      previous.startNodeId !== candidate.startNodeId ||
      previous.endNodeId !== candidate.endNodeId ||
      previous.thicknessUm !== candidate.thicknessUm
    ) {
      throw new Error(`A2.5 movement changed identity, connectivity, or thickness of wall ${identity}.`);
    }
  }
}

function assertFacesPreserved(before: TopologyV2, after: TopologyV2): void {
  const beforeFaceIds = extractBoundedFaces(before).faces.map((face) => face.id).sort();
  const afterFaceIds = extractBoundedFaces(after).faces.map((face) => face.id).sort();
  if (!equalStrings(beforeFaceIds, afterFaceIds)) {
    throw new Error("A2.5 movement changed bounded-face identity.");
  }
}

function deriveAffectedNodeIds(before: TopologyV2, after: TopologyV2): NodeId[] {
  return (Object.keys(before.nodes).sort() as NodeId[]).filter((identity) =>
    before.nodes[identity]!.xUm !== after.nodes[identity]!.xUm ||
    before.nodes[identity]!.yUm !== after.nodes[identity]!.yUm);
}

function deriveAffectedWallIds(before: TopologyV2, affectedNodeIds: readonly NodeId[]): WallId[] {
  const affectedNodes = new Set(affectedNodeIds);
  return (Object.keys(before.walls).sort() as WallId[]).filter((identity) => {
    const wall = before.walls[identity]!;
    return affectedNodes.has(wall.startNodeId) || affectedNodes.has(wall.endNodeId);
  });
}

function assertMetadataMatches(
  metadata: TopologyMoveMetadata,
  before: TopologyV2,
  after: TopologyV2,
  affectedNodeIds: readonly NodeId[],
  affectedWallIds: readonly WallId[],
): void {
  const metadataNodeIds = metadata.nodeChanges.map((change) => change.nodeId).sort();
  const metadataWallIds = [...metadata.affectedWallIds].sort();
  if (!equalStrings(metadataNodeIds, affectedNodeIds)) {
    throw new Error("A2.5 movement node-change metadata does not match the candidate topology.");
  }
  if (!equalStrings(metadataWallIds, affectedWallIds)) {
    throw new Error("A2.5 movement affected-wall metadata does not match the candidate topology.");
  }
  for (const change of metadata.nodeChanges) {
    const previous = before.nodes[change.nodeId]!;
    const candidate = after.nodes[change.nodeId]!;
    if (
      change.before.xUm !== previous.xUm ||
      change.before.yUm !== previous.yUm ||
      change.after.xUm !== candidate.xUm ||
      change.after.yUm !== candidate.yUm
    ) {
      throw new Error(`A2.5 movement coordinate metadata does not match node ${change.nodeId}.`);
    }
  }
}

function emptyClassifications(): AffectedWallClassifications {
  return {
    exteriorWallIds: [],
    internalSharedWallIds: [],
    nonFaceBoundaryWallIds: [],
  };
}

function assertClassificationsPreserved(
  before: ReturnType<typeof deriveExteriorBoundary>,
  after: ReturnType<typeof deriveExteriorBoundary>,
): void {
  if (
    !equalStrings(before.exteriorWallIds, after.exteriorWallIds) ||
    !equalStrings(before.internalSharedWallIds, after.internalSharedWallIds) ||
    !equalStrings(before.nonFaceBoundaryWallIds, after.nonFaceBoundaryWallIds)
  ) {
    throw new Error("A2.5 movement changed canonical wall boundary classification.");
  }
}

function classifyAffectedWalls(
  affectedWallIds: readonly WallId[],
  boundary: ReturnType<typeof deriveExteriorBoundary>,
): AffectedWallClassifications {
  const affected = new Set(affectedWallIds);
  return {
    exteriorWallIds: boundary.exteriorWallIds.filter((identity) => affected.has(identity)),
    internalSharedWallIds: boundary.internalSharedWallIds.filter((identity) => affected.has(identity)),
    nonFaceBoundaryWallIds: boundary.nonFaceBoundaryWallIds.filter((identity) => affected.has(identity)),
  };
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
