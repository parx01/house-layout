import {
  evaluateFootprintMoveTransaction,
  type AffectedWallClassifications,
} from "../building/footprint-transaction.js";
import type { DerivedPhysicalExteriorEnvelopeV1 } from "../building/physical-exterior-envelope.js";
import {
  applyTopologyMoveTransaction,
  ProjectTopologyUpdateError,
} from "../project/topology-update.js";
import type { ProjectV2 } from "../project/schema.js";
import { validateProjectV2 } from "../project/validation.js";
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

export type InteractionCommitResult =
  | {
      readonly status: "committed";
      readonly project: ProjectV2;
      readonly undoableChange: UndoableProjectChange;
      readonly previewCount: number;
    }
  | {
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

export class InteractionLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InteractionLifecycleError";
  }
}

/**
 * UI-independent B0 gesture transaction.
 *
 * Every preview is evaluated from the immutable begin snapshot, never from a
 * preceding preview. Pointer dragging and future typed dimensions therefore
 * share the same A2.5 -> project reconciliation -> commit path.
 */
export class ProjectInteractionController {
  readonly #originalProject: ProjectV2;
  #committedProject: ProjectV2;
  #phase: InteractionPhase = "active";
  #previewCount = 0;
  #latestPreview: InteractionPreviewResult | null = null;
  #lastValidPreview: ValidInteractionPreview | null = null;

  private constructor(projectValue: ProjectV2) {
    const project = validateProjectV2(projectValue);
    if (project.topology.status !== "active") {
      throw new InteractionLifecycleError("A topology interaction requires an active project topology.");
    }
    this.#originalProject = immutable(project);
    this.#committedProject = this.#originalProject;
  }

  static begin(projectValue: ProjectV2): ProjectInteractionController {
    return new ProjectInteractionController(projectValue);
  }

  preview(movement: (topology: TopologyV2) => TopologyMoveResult): InteractionPreviewResult {
    this.#requireActive("preview");
    this.#previewCount += 1;
    const sequence = this.#previewCount;
    const topology = activeTopology(this.#originalProject);
    const footprint = evaluateFootprintMoveTransaction(topology, movement);
    if (footprint.status === "rejected") {
      const failed = immutable<FailedInteractionPreview>({
        status: "invalid",
        sequence,
        source: "movement",
        errorName: footprint.errorName,
        reason: footprint.reason,
        reconciliation: null,
      });
      this.#latestPreview = failed;
      return cloneImmutable(failed);
    }

    try {
      const update = applyTopologyMoveTransaction(this.#originalProject, {
        topology: footprint.committedTopology,
        metadata: footprint.movementMetadata,
      });
      const valid = immutable<ValidInteractionPreview>({
        status: "valid",
        sequence,
        candidateProject: update.project,
        metadata: {
          affectedNodeIds: footprint.affectedNodeIds,
          affectedWallIds: footprint.affectedWallIds,
          involvedWallClassifications: footprint.involvedWallClassifications,
          semanticReconciliation: update.reconciliation,
          footprintChanged: footprint.footprintChanged,
          beforeEnvelope: footprint.beforeEnvelope,
          afterEnvelope: footprint.afterEnvelope,
          movement: footprint.movementMetadata,
        },
      });
      this.#latestPreview = valid;
      this.#lastValidPreview = valid;
      return cloneImmutable(valid);
    } catch (error) {
      const reconciliation = error instanceof ProjectTopologyUpdateError
        ? error.reconciliation ?? null
        : null;
      const failed = immutable<FailedInteractionPreview>({
        status: reconciliation?.status === "remapRequired" ? "remapRequired" : "invalid",
        sequence,
        source: "projectUpdate",
        errorName: error instanceof Error ? error.name : "UnknownError",
        reason: error instanceof Error ? error.message : String(error),
        reconciliation,
      });
      this.#latestPreview = failed;
      return cloneImmutable(failed);
    }
  }

  /** Completes the gesture once, committing at most the last valid preview. */
  commit(): InteractionCommitResult {
    this.#requireActive("commit");
    this.#phase = "completed";
    if (!this.#lastValidPreview) {
      return cloneImmutable({
        status: "noChange" as const,
        project: this.#originalProject,
        undoableChange: null,
        previewCount: this.#previewCount,
        failure: this.#latestPreview?.status === "valid" ? null : this.#latestPreview,
      });
    }

    this.#committedProject = this.#lastValidPreview.candidateProject;
    const result: InteractionCommitResult = {
      status: "committed",
      project: this.#committedProject,
      previewCount: this.#previewCount,
      undoableChange: {
        beforeProject: this.#originalProject,
        afterProject: this.#committedProject,
        metadata: this.#lastValidPreview.metadata,
      },
    };
    return cloneImmutable(result);
  }

  cancel(reason: InteractionCancelReason = "explicit"): InteractionCancelResult {
    this.#requireActive("cancel");
    this.#phase = "cancelled";
    this.#committedProject = this.#originalProject;
    return cloneImmutable({
      status: "cancelled" as const,
      reason,
      project: this.#originalProject,
      undoableChange: null,
      previewCount: this.#previewCount,
    });
  }

  snapshot(): InteractionControllerSnapshot {
    return cloneImmutable({
      phase: this.#phase,
      previewCount: this.#previewCount,
      originalProject: this.#originalProject,
      committedProject: this.#committedProject,
      latestPreview: this.#latestPreview,
      lastValidPreview: this.#lastValidPreview,
    });
  }

  #requireActive(action: string): void {
    if (this.#phase !== "active") {
      throw new InteractionLifecycleError(`Cannot ${action} an interaction after it is ${this.#phase}.`);
    }
  }
}

function activeTopology(project: ProjectV2): TopologyV2 {
  if (project.topology.status !== "active") {
    throw new InteractionLifecycleError("A topology interaction requires an active project topology.");
  }
  return project.topology;
}

function cloneImmutable<T>(value: T): T {
  return immutable(structuredClone(value));
}

function immutable<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) immutable(child);
  return Object.freeze(value);
}
