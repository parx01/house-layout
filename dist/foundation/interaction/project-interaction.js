import { evaluateFootprintMoveTransaction, } from "../building/footprint-transaction.js";
import { applyTopologyMoveTransaction, ProjectTopologyUpdateError, } from "../project/topology-update.js";
import { validateProjectV2 } from "../project/validation.js";
export class InteractionLifecycleError extends Error {
    constructor(message) {
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
    #originalProject;
    #committedProject;
    #phase = "active";
    #previewCount = 0;
    #latestPreview = null;
    #lastValidPreview = null;
    constructor(projectValue) {
        const project = validateProjectV2(projectValue);
        if (project.topology.status !== "active") {
            throw new InteractionLifecycleError("A topology interaction requires an active project topology.");
        }
        this.#originalProject = immutable(project);
        this.#committedProject = this.#originalProject;
    }
    static begin(projectValue) {
        return new ProjectInteractionController(projectValue);
    }
    preview(movement) {
        this.#requireActive("preview");
        this.#previewCount += 1;
        const sequence = this.#previewCount;
        const topology = activeTopology(this.#originalProject);
        const footprint = evaluateFootprintMoveTransaction(topology, movement);
        if (footprint.status === "rejected") {
            const failed = immutable({
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
            const valid = immutable({
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
        }
        catch (error) {
            const reconciliation = error instanceof ProjectTopologyUpdateError
                ? error.reconciliation ?? null
                : null;
            const failed = immutable({
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
    commit() {
        this.#requireActive("commit");
        this.#phase = "completed";
        if (!this.#lastValidPreview) {
            return cloneImmutable({
                status: "noChange",
                project: this.#originalProject,
                undoableChange: null,
                previewCount: this.#previewCount,
                failure: this.#latestPreview?.status === "valid" ? null : this.#latestPreview,
            });
        }
        this.#committedProject = this.#lastValidPreview.candidateProject;
        const result = {
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
    cancel(reason = "explicit") {
        this.#requireActive("cancel");
        this.#phase = "cancelled";
        this.#committedProject = this.#originalProject;
        return cloneImmutable({
            status: "cancelled",
            reason,
            project: this.#originalProject,
            undoableChange: null,
            previewCount: this.#previewCount,
        });
    }
    snapshot() {
        return cloneImmutable({
            phase: this.#phase,
            previewCount: this.#previewCount,
            originalProject: this.#originalProject,
            committedProject: this.#committedProject,
            latestPreview: this.#latestPreview,
            lastValidPreview: this.#lastValidPreview,
        });
    }
    #requireActive(action) {
        if (this.#phase !== "active") {
            throw new InteractionLifecycleError(`Cannot ${action} an interaction after it is ${this.#phase}.`);
        }
    }
}
function activeTopology(project) {
    if (project.topology.status !== "active") {
        throw new InteractionLifecycleError("A topology interaction requires an active project topology.");
    }
    return project.topology;
}
function cloneImmutable(value) {
    return immutable(structuredClone(value));
}
function immutable(value) {
    if (value === null || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const child of Object.values(value))
        immutable(child);
    return Object.freeze(value);
}
//# sourceMappingURL=project-interaction.js.map