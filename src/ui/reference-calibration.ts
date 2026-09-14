import { OPTION_3_SITE_DEPTH_UM, OPTION_3_SITE_WIDTH_UM } from "../core/site.js";
import { lengthUm, type LengthUm } from "../core/units.js";

export const OPTION_3_REFERENCE_WIDTH_UM = OPTION_3_SITE_WIDTH_UM;
export const OPTION_3_REFERENCE_DEPTH_UM = OPTION_3_SITE_DEPTH_UM;
export const CANVAS_MARGIN_UM = lengthUm(900_000);

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
export function calculateOption3CanvasViewBox(
  siteWidthUm: LengthUm,
  siteDepthUm: LengthUm,
): CanvasViewBoxUm {
  return {
    xUm: -CANVAS_MARGIN_UM,
    yUm: -CANVAS_MARGIN_UM,
    widthUm: Math.max(siteWidthUm, OPTION_3_REFERENCE_WIDTH_UM) + 2 * CANVAS_MARGIN_UM,
    depthUm: Math.max(siteDepthUm, OPTION_3_REFERENCE_DEPTH_UM) + 2 * CANVAS_MARGIN_UM,
  };
}
