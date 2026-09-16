import { type DerivedPhysicalExteriorEnvelopeV1 } from "./physical-exterior-envelope.js";
import type { NodeId, TopologyV2, WallId } from "../topology/model.js";
import type { TopologyMoveMetadata, TopologyMoveResult } from "../topology/movement.js";
export interface AffectedWallClassifications {
    readonly exteriorWallIds: readonly WallId[];
    readonly internalSharedWallIds: readonly WallId[];
    readonly nonFaceBoundaryWallIds: readonly WallId[];
}
export type FootprintMoveTransactionResult = {
    readonly status: "committed";
    readonly committedTopology: TopologyV2;
    readonly movementMetadata: TopologyMoveMetadata;
    readonly affectedNodeIds: readonly NodeId[];
    readonly affectedWallIds: readonly WallId[];
    readonly involvedWallClassifications: AffectedWallClassifications;
    readonly beforeEnvelope: DerivedPhysicalExteriorEnvelopeV1;
    readonly afterEnvelope: DerivedPhysicalExteriorEnvelopeV1;
    readonly footprintChanged: boolean;
} | {
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
export declare function evaluateFootprintMoveTransaction(topologyValue: TopologyV2, movement: (topology: TopologyV2) => TopologyMoveResult): FootprintMoveTransactionResult;
//# sourceMappingURL=footprint-transaction.d.ts.map