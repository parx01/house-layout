import type { TopologyMoveResult } from "../topology/movement.js";
import type { ProjectV2 } from "./schema.js";
export type ProjectTopologyUpdateFailureStage = "inputProject" | "moveResult" | "semanticSpaces" | "candidateProject";
export declare class ProjectTopologyUpdateError extends Error {
    readonly stage: ProjectTopologyUpdateFailureStage;
    constructor(stage: ProjectTopologyUpdateFailureStage, message: string, options?: ErrorOptions);
}
/**
 * Atomically accepts an A2.5 movement result as the project's new canonical
 * topology. Legacy rectangles are intentionally untouched reference data.
 */
export declare function applyTopologyMoveResult(projectValue: ProjectV2, moveResult: TopologyMoveResult): ProjectV2;
//# sourceMappingURL=topology-update.d.ts.map