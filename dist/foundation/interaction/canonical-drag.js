import { coordinateUm } from "../core/units.js";
import { getWallOrientation, } from "../topology/model.js";
import { moveJunction, moveWallPerpendicular } from "../topology/movement.js";
import { ProjectInteractionController, } from "./project-interaction.js";
export const DRAG_ACTIVATION_THRESHOLD_PX = 3;
/**
 * Convert a CSS/client point through an inverse SVG screen transform. SVG view
 * units in this editor are millimetres, while canonical geometry uses integer
 * micrometres.
 */
export function clientPointToModelUm(point, inverseScreenTransform) {
    assertFinitePoint(point, "Client point");
    for (const key of ["a", "b", "c", "d", "e", "f"]) {
        const value = inverseScreenTransform[key];
        if (!Number.isFinite(value))
            throw new TypeError(`Inverse screen transform ${key} must be finite.`);
    }
    return exactModelPoint({
        xUm: Math.round((inverseScreenTransform.a * point.x + inverseScreenTransform.c * point.y + inverseScreenTransform.e) * 1_000),
        yUm: Math.round((inverseScreenTransform.b * point.x + inverseScreenTransform.d * point.y + inverseScreenTransform.f) * 1_000),
    }, "Transformed model point");
}
export function exceedsDragActivationThreshold(start, current, thresholdPx = DRAG_ACTIVATION_THRESHOLD_PX) {
    assertFinitePoint(start, "Drag start");
    assertFinitePoint(current, "Drag current point");
    if (!Number.isFinite(thresholdPx) || thresholdPx < 0) {
        throw new TypeError("Drag activation threshold must be a non-negative finite number.");
    }
    return Math.hypot(current.x - start.x, current.y - start.y) >= thresholdPx;
}
export function canCommitCanonicalDrag(preview) {
    return preview?.status === "valid" && preview.metadata.movement.nodeChanges.length > 0;
}
/**
 * UI-independent B2 adapter. Every preview delegates to the B0 controller,
 * which evaluates A2.5 movement from the immutable begin snapshot.
 */
export class CanonicalDragController {
    #interaction;
    #entity;
    #startPoint;
    #wallOrientation;
    #nodeStart;
    constructor(project, entity, startPoint) {
        this.#interaction = ProjectInteractionController.begin(project);
        const snapshot = this.#interaction.snapshot();
        if (snapshot.originalProject.topology.status !== "active") {
            throw new TypeError("Canonical dragging requires active topology.");
        }
        const topology = snapshot.originalProject.topology;
        if (entity.type === "wall") {
            if (!topology.walls[entity.id])
                throw new TypeError(`Topology wall ${entity.id} does not exist.`);
            this.#wallOrientation = getWallOrientation(topology, entity.id);
            this.#nodeStart = null;
        }
        else {
            const node = topology.nodes[entity.id];
            if (!node)
                throw new TypeError(`Topology node ${entity.id} does not exist.`);
            this.#wallOrientation = null;
            this.#nodeStart = Object.freeze({ xUm: node.xUm, yUm: node.yUm });
        }
        this.#entity = Object.freeze({ ...entity });
        this.#startPoint = exactModelPoint(startPoint, "Drag start point");
    }
    static begin(project, entity, startPoint) {
        return new CanonicalDragController(project, entity, startPoint);
    }
    preview(pointerPoint) {
        const point = exactModelPoint(pointerPoint, "Drag pointer point");
        const deltaXUm = point.xUm - this.#startPoint.xUm;
        const deltaYUm = point.yUm - this.#startPoint.yUm;
        let preview;
        if (this.#entity.type === "wall") {
            const wallId = this.#entity.id;
            preview = this.#interaction.preview((topology) => moveWallPerpendicular(topology, wallId, this.#wallOrientation === "horizontal" ? deltaYUm : deltaXUm));
        }
        else {
            const nodeId = this.#entity.id;
            preview = this.#interaction.preview((topology) => moveJunction(topology, nodeId, {
                xUm: coordinateUm(this.#nodeStart.xUm + deltaXUm),
                yUm: coordinateUm(this.#nodeStart.yUm + deltaYUm),
            }));
        }
        const snapshot = this.#interaction.snapshot();
        return Object.freeze({
            preview,
            displayProject: preview.status === "valid"
                ? preview.candidateProject
                : snapshot.lastValidPreview?.candidateProject ?? snapshot.originalProject,
        });
    }
    commit() {
        const snapshot = this.#interaction.snapshot();
        if (!canCommitCanonicalDrag(snapshot.latestPreview)) {
            return Object.freeze({
                status: "cancelled",
                reason: snapshot.latestPreview?.status === "valid" || !snapshot.latestPreview
                    ? "noValidPreview"
                    : "invalidRelease",
                result: this.#interaction.cancel("explicit"),
                failure: snapshot.latestPreview,
            });
        }
        const result = this.#interaction.commit();
        if (result.status !== "committed") {
            throw new Error("A valid canonical drag preview did not produce a committed project change.");
        }
        return Object.freeze({ status: "committed", result });
    }
    cancel(reason) {
        return this.#interaction.cancel(reason);
    }
    snapshot() {
        return this.#interaction.snapshot();
    }
}
function exactModelPoint(value, label) {
    if (!Number.isSafeInteger(value.xUm) || !Number.isSafeInteger(value.yUm)) {
        throw new TypeError(`${label} must contain safe integer micrometre coordinates.`);
    }
    return Object.freeze({ xUm: value.xUm, yUm: value.yUm });
}
function assertFinitePoint(value, label) {
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
        throw new TypeError(`${label} must contain finite coordinates.`);
    }
}
//# sourceMappingURL=canonical-drag.js.map