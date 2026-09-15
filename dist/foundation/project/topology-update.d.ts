import { type SemanticReconciliationReport } from "../spaces/semantic-rebinding.js";
import type { TopologyV2 } from "../topology/model.js";
import type { TopologyMoveResult } from "../topology/movement.js";
import type { TopologyChangeResult } from "../topology/operations.js";
import type { ProjectV2 } from "./schema.js";
export type ProjectTopologyUpdateFailureStage = "inputProject" | "moveResult" | "semanticSpaces" | "candidateProject";
export declare class ProjectTopologyUpdateError extends Error {
    readonly stage: ProjectTopologyUpdateFailureStage;
    readonly reconciliation?: SemanticReconciliationReport | undefined;
    constructor(stage: ProjectTopologyUpdateFailureStage, message: string, options?: ErrorOptions, reconciliation?: SemanticReconciliationReport | undefined);
}
export type ProjectTopologyTransactionResult = {
    readonly status: "committed";
    readonly project: ProjectV2;
    readonly reconciliation: SemanticReconciliationReport;
} | {
    readonly status: "remapRequired";
    readonly candidateTopology: TopologyV2;
    readonly reconciliation: SemanticReconciliationReport & {
        readonly status: "remapRequired";
    };
};
/**
 * Atomically accepts an A2.5 movement result as the project's new canonical
 * topology. Legacy rectangles are intentionally untouched reference data.
 */
export declare function applyTopologyMoveResult(projectValue: ProjectV2, moveResult: TopologyMoveResult): ProjectV2;
/** A2.5-compatible wrapper that also exposes the A3.3 reconciliation report. */
export declare function applyTopologyMoveTransaction(projectValue: ProjectV2, moveResult: TopologyMoveResult): Extract<ProjectTopologyTransactionResult, {
    readonly status: "committed";
}>;
/** Accepts an A2.2 canonical change result through the same atomic semantic gate. */
export declare function applyTopologyChangeResult(projectValue: ProjectV2, changeResult: TopologyChangeResult): ProjectTopologyTransactionResult;
/**
 * Validates and prepares any canonical topology replacement. A semantic
 * ambiguity returns `remapRequired` without constructing or mutating a project.
 */
export declare function applyCanonicalTopologyUpdate(projectValue: ProjectV2, topologyValue: TopologyV2): ProjectTopologyTransactionResult;
//# sourceMappingURL=topology-update.d.ts.map