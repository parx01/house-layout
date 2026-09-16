import { type AffectedWallClassifications } from "../building/footprint-transaction.js";
import type { DerivedPhysicalExteriorEnvelopeV1 } from "../building/physical-exterior-envelope.js";
import type { ProjectV2 } from "../project/schema.js";
import type { SemanticReconciliationReport } from "../spaces/semantic-rebinding.js";
import type { NodeId, TopologyV2, WallId } from "../topology/model.js";
import type { TopologyMoveMetadata, TopologyMoveResult } from "../topology/movement.js";
export type InteractionCancelReason = "explicit" | "escape" | "pointerCancel";
export type InteractionPhase = "active" | "completed" | "cancelled";
export interface InteractionTransactionMetadata {
    readonly affectedNodeIds: readonly NodeId[];
    readonly affectedWallIds: readonly WallId[];
    readonly involvedWallClassifications: AffectedWallClassifications;
    readonly semanticReconciliation: SemanticReconciliationReport;
    readonly footprintChanged: boolean;
    readonly beforeEnvelope: DerivedPhysicalExteriorEnvelopeV1;
    readonly afterEnvelope: DerivedPhysicalExteriorEnvelopeV1;
    readonly movement: TopologyMoveMetadata;
}
export interface ValidInteractionPreview {
    readonly status: "valid";
    readonly sequence: number;
    readonly candidateProject: ProjectV2;
    readonly metadata: InteractionTransactionMetadata;
}
export interface FailedInteractionPreview {
    readonly status: "invalid" | "remapRequired";
    readonly sequence: number;
    readonly source: "movement" | "projectUpdate";
    readonly errorName: string;
    readonly reason: string;
    readonly reconciliation: SemanticReconciliationReport | null;
}
export type InteractionPreviewResult = ValidInteractionPreview | FailedInteractionPreview;
export interface InteractionControllerSnapshot {
    readonly phase: InteractionPhase;
    readonly previewCount: number;
    readonly originalProject: ProjectV2;
    readonly committedProject: ProjectV2;
    readonly latestPreview: InteractionPreviewResult | null;
    readonly lastValidPreview: ValidInteractionPreview | null;
}
export interface UndoableProjectChange {
    readonly beforeProject: ProjectV2;
    readonly afterProject: ProjectV2;
    readonly metadata: InteractionTransactionMetadata;
}
export type InteractionCommitResult = {
    readonly status: "committed";
    readonly project: ProjectV2;
    readonly undoableChange: UndoableProjectChange;
    readonly previewCount: number;
} | {
    readonly status: "noChange";
    readonly project: ProjectV2;
    readonly undoableChange: null;
    readonly previewCount: number;
    readonly failure: FailedInteractionPreview | null;
};
export interface InteractionCancelResult {
    readonly status: "cancelled";
    readonly reason: InteractionCancelReason;
    readonly project: ProjectV2;
    readonly undoableChange: null;
    readonly previewCount: number;
}
export declare class InteractionLifecycleError extends Error {
    constructor(message: string);
}
/**
 * UI-independent B0 gesture transaction.
 *
 * Every preview is evaluated from the immutable begin snapshot, never from a
 * preceding preview. Pointer dragging and future typed dimensions therefore
 * share the same A2.5 -> project reconciliation -> commit path.
 */
export declare class ProjectInteractionController {
    #private;
    private constructor();
    static begin(projectValue: ProjectV2): ProjectInteractionController;
    preview(movement: (topology: TopologyV2) => TopologyMoveResult): InteractionPreviewResult;
    /** Completes the gesture once, committing at most the last valid preview. */
    commit(): InteractionCommitResult;
    cancel(reason?: InteractionCancelReason): InteractionCancelResult;
    snapshot(): InteractionControllerSnapshot;
}
//# sourceMappingURL=project-interaction.d.ts.map