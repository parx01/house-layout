import type { AreaUm2 } from "../core/units.js";
import type { TopologyV2, WallId } from "../topology/model.js";
import type { FaceId } from "./model.js";
import { type SemanticSpacesV2, type SpaceId } from "./semantic-model.js";
export type SemanticRebindingFailureReason = "orphanedFace" | "faceSplit" | "faceMerge" | "ambiguousCorrespondence";
export interface FaceCorrespondenceEvidence {
    readonly overlapAreaUm2: AreaUm2;
    readonly previousFaceCoveragePpm: number;
    readonly candidateFaceCoveragePpm: number;
    readonly sharedBoundaryLengthUm: number;
    readonly sharedCanonicalWallIds: readonly WallId[];
    readonly containment: "sameGeometry" | "previousContainsCandidate" | "candidateContainsPrevious" | "none";
}
export interface PreservedSemanticBinding {
    readonly spaceId: SpaceId;
    readonly faceId: FaceId;
}
export interface ReboundSemanticBinding {
    readonly spaceId: SpaceId;
    readonly previousFaceId: FaceId;
    readonly faceId: FaceId;
    readonly evidence: FaceCorrespondenceEvidence;
}
export interface UnresolvedSemanticSpace {
    readonly spaceId: SpaceId;
    readonly previousFaceId: FaceId;
    readonly reason: SemanticRebindingFailureReason;
    readonly candidateFaceIds: readonly FaceId[];
}
export interface SemanticReconciliationReport {
    readonly status: "resolved" | "remapRequired";
    readonly preservedBindings: readonly PreservedSemanticBinding[];
    readonly reboundBindings: readonly ReboundSemanticBinding[];
    readonly unresolvedSpaces: readonly UnresolvedSemanticSpace[];
    /** Candidate faces whose derived identities did not exist before the transaction. */
    readonly newFaceIds: readonly FaceId[];
    /** Candidate faces not claimed by a safely preserved or rebound space. */
    readonly unclaimedFaceIds: readonly FaceId[];
}
export type SemanticReconciliationResult = {
    readonly status: "resolved";
    readonly spaces: SemanticSpacesV2;
    readonly report: SemanticReconciliationReport & {
        readonly status: "resolved";
    };
} | {
    readonly status: "remapRequired";
    readonly report: SemanticReconciliationReport & {
        readonly status: "remapRequired";
    };
};
/**
 * Reconciles persistent semantic identities with a newly derived face set.
 *
 * Face IDs that survive are preserved directly. A changed FaceId is rebound
 * only when exact polygon overlap establishes a mutual one-to-one
 * correspondence and the faces retain canonical boundary geometry. Splits,
 * merges, deletions, weak/ambiguous matches, and unclaimed candidate faces
 * remain explicit for a later human remapping workflow.
 */
export declare function reconcileSemanticSpaces(spacesValue: SemanticSpacesV2, previousTopology: TopologyV2, candidateTopology: TopologyV2): SemanticReconciliationResult;
//# sourceMappingURL=semantic-rebinding.d.ts.map