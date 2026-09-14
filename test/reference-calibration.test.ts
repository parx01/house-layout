import { describe, expect, it } from "vitest";
import { feet, lengthUm } from "../src/core/units.js";
import {
  CANVAS_MARGIN_UM,
  calculateOption3CanvasViewBox,
  OPTION_3_REFERENCE_DEPTH_UM,
  OPTION_3_REFERENCE_WIDTH_UM,
} from "../src/ui/reference-calibration.js";

describe("Option-3 reference calibration", () => {
  it("keeps the source image calibration fixed when the experimental site shrinks", () => {
    const viewBox = calculateOption3CanvasViewBox(feet(40), feet(60));
    expect(OPTION_3_REFERENCE_WIDTH_UM).toBe(14_986_000);
    expect(OPTION_3_REFERENCE_DEPTH_UM).toBe(24_130_000);
    expect(viewBox.widthUm).toBe(OPTION_3_REFERENCE_WIDTH_UM + 2 * CANVAS_MARGIN_UM);
    expect(viewBox.depthUm).toBe(OPTION_3_REFERENCE_DEPTH_UM + 2 * CANVAS_MARGIN_UM);
  });

  it("expands the drawing frame when the editable site grows", () => {
    const siteWidthUm = lengthUm(20_000_000);
    const siteDepthUm = lengthUm(30_000_000);
    const viewBox = calculateOption3CanvasViewBox(siteWidthUm, siteDepthUm);
    expect(viewBox.widthUm).toBe(siteWidthUm + 2 * CANVAS_MARGIN_UM);
    expect(viewBox.depthUm).toBe(siteDepthUm + 2 * CANVAS_MARGIN_UM);
  });
});
