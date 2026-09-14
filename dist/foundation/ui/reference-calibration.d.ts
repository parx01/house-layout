import { type LengthUm } from "../core/units.js";
export declare const OPTION_3_REFERENCE_WIDTH_UM: LengthUm;
export declare const OPTION_3_REFERENCE_DEPTH_UM: LengthUm;
export declare const CANVAS_MARGIN_UM: LengthUm;
export interface CanvasViewBoxUm {
    readonly xUm: number;
    readonly yUm: number;
    readonly widthUm: number;
    readonly depthUm: number;
}
/**
 * Frames both the editable property and the fixed Option-3 reference image.
 * Experimental site dimensions therefore cannot stretch or hide the source
 * calibration while the editable boundary and grid continue to track the site.
 */
export declare function calculateOption3CanvasViewBox(siteWidthUm: LengthUm, siteDepthUm: LengthUm): CanvasViewBoxUm;
//# sourceMappingURL=reference-calibration.d.ts.map