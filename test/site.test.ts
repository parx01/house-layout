import { describe, expect, it } from "vitest";
import { rectUm } from "../src/core/geometry.js";
import {
  calculateBuildableEnvelope,
  calculateMaximumCoverage,
  calculatePlotArea,
  calculateSiteWarnings,
  createOption3Site,
} from "../src/core/site.js";
import { areaToSquareFeet, areaUm2, feet } from "../src/core/units.js";

describe("Option 3 site calculations", () => {
  it("uses the exact 49'2\" x 79'2\" property boundary", () => {
    const site = createOption3Site();
    expect(site.boundary.widthUm).toBe(14_986_000);
    expect(site.boundary.depthUm).toBe(24_130_000);
    expect(site.frontEdgeIndex).toBe(2);
    expect(site.orientation.northAngleDeg).toBeNull();
    expect(site.road.widthUm).toBe(12_000_000);
    expect(site.road.widthProvenance).toEqual({
      kind: "referencePlanSuppliedUnverified",
      sourceDocument: "OPTION-3.pdf",
      sourceLabel: "ROAD 12.00M WIDE",
    });
  });

  it("calculates the exact plot area", () => {
    const area = calculatePlotArea(createOption3Site());
    expect(area).toBe(361_612_180_000_000);
    expect(areaToSquareFeet(area)).toBeCloseTo(3_892.3611111111, 10);
  });

  it("calculates the supplied 66% limit exactly", () => {
    const maximum = calculateMaximumCoverage(createOption3Site());
    expect(maximum).toBe(238_664_038_800_000);
    expect(areaToSquareFeet(maximum)).toBeCloseTo(2_568.9583333333, 10);
  });

  it("calculates the 4-foot side design offsets", () => {
    const envelope = calculateBuildableEnvelope(createOption3Site(), "minimum");
    expect(envelope.xUm).toBe(feet(4));
    expect(envelope.widthUm).toBe(14_986_000 - feet(4) - feet(4));
  });

  it("calculates the 8-foot minimum and 10-foot preferred rear targets", () => {
    const site = createOption3Site();
    const minimum = calculateBuildableEnvelope(site, "minimum");
    const preferred = calculateBuildableEnvelope(site, "preferred");
    expect(minimum.yUm).toBe(feet(8));
    expect(preferred.yUm).toBe(feet(10));
    expect(minimum.depthUm - preferred.depthUm).toBe(feet(2));
  });

  it("keeps the front target flexible", () => {
    const site = createOption3Site();
    expect(site.designSetbacks.frontMinUm).toBeNull();
    expect(calculateBuildableEnvelope(site).depthUm).toBe(site.boundary.depthUm - feet(8));
  });

  it("categorises boundary, coverage, and design-target warnings separately", () => {
    const site = createOption3Site();
    const outside = rectUm(-1, 0, feet(20), feet(20));
    const boundaryWarnings = calculateSiteWarnings(site, outside);
    expect(boundaryWarnings.map((warning) => warning.category)).toEqual(["propertyBoundaryViolation"]);

    const missesTargets = rectUm(feet(3), feet(9), feet(40), feet(40));
    const targetWarnings = calculateSiteWarnings(site, missesTargets);
    expect(targetWarnings.some((warning) => warning.category === "designTargetViolation")).toBe(true);
    expect(targetWarnings.some((warning) => warning.code === "rearPreferredDesignTargetNotMet")).toBe(true);

    const coverageWarnings = calculateSiteWarnings(site, null, areaUm2(calculateMaximumCoverage(site) + 1));
    expect(coverageWarnings.map((warning) => warning.category)).toEqual(["coverageLimitViolation"]);
    expect(coverageWarnings.some((warning) => warning.category === "regulatoryViolation")).toBe(false);
  });
});
