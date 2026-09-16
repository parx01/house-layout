import type { ProjectV2 } from "../project/schema.js";
import { type NodeId, type WallId } from "../topology/model.js";
import { type InteractionCancelReason, type InteractionCancelResult, type InteractionCommitResult, type InteractionPreviewResult } from "./project-interaction.js";
export declare const DRAG_ACTIVATION_THRESHOLD_PX = 3;
export interface ScreenPoint {
    readonly x: number;
    readonly y: number;
}
export interface ModelPointUm {
    readonly xUm: number;
    readonly yUm: number;
}
/** The six values used by DOMMatrix to transform a two-dimensional point. */
export interface AffineTransform2D {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly d: number;
    readonly e: number;
    readonly f: number;
}
export type CanonicalDragEntity = {
    readonly type: "wall";
    readonly id: WallId;
} | {
    readonly type: "node";
    readonly id: NodeId;
};
export interface CanonicalDragPreview {
    readonly preview: InteractionPreviewResult;
    /** Valid candidate, last valid candidate, or the original project in that order. */
    readonly displayProject: ProjectV2;
}
export type CanonicalDragCommitResult = {
    readonly status: "committed";
    readonly result: InteractionCommitResult & {
        readonly status: "committed";
    };
} | {
    readonly status: "cancelled";
    readonly reason: "invalidRelease" | "noValidPreview";
    readonly result: InteractionCancelResult;
    readonly failure: InteractionPreviewResult | null;
};
/**
 * Convert a CSS/client point through an inverse SVG screen transform. SVG view
 * units in this editor are millimetres, while canonical geometry uses integer
 * micrometres.
 */
export declare function clientPointToModelUm(point: ScreenPoint, inverseScreenTransform: AffineTransform2D): ModelPointUm;
export declare function exceedsDragActivationThreshold(start: ScreenPoint, current: ScreenPoint, thresholdPx?: number): boolean;
export declare function canCommitCanonicalDrag(preview: InteractionPreviewResult | null): boolean;
/**
 * UI-independent B2 adapter. Every preview delegates to the B0 controller,
 * which evaluates A2.5 movement from the immutable begin snapshot.
 */
export declare class CanonicalDragController {
    #private;
    private constructor();
    static begin(project: ProjectV2, entity: CanonicalDragEntity, startPoint: ModelPointUm): CanonicalDragController;
    preview(pointerPoint: ModelPointUm): CanonicalDragPreview;
    commit(): CanonicalDragCommitResult;
    cancel(reason: InteractionCancelReason): InteractionCancelResult;
    snapshot(): import("./project-interaction.js").InteractionControllerSnapshot;
}
//# sourceMappingURL=canonical-drag.d.ts.map