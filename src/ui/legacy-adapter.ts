import type { AreaUm2, LengthUm } from "../core/units.js";
import { areaUm2, legacyMmToUm, umToLegacyMm } from "../core/units.js";
import { calculateBuildableEnvelope, calculateMaximumCoverage, calculatePlotArea } from "../core/site.js";
import type { LegacyEditorStateV1, ProjectV2 } from "../project/schema.js";

export interface LegacyFoundationSummary {
  readonly plotAreaUm2: AreaUm2;
  readonly maximumCoverageUm2: AreaUm2;
  readonly minimumEnvelope: ReturnType<typeof calculateBuildableEnvelope>;
  readonly preferredEnvelope: ReturnType<typeof calculateBuildableEnvelope>;
}

export function foundationSummary(project: ProjectV2): LegacyFoundationSummary {
  return {
    plotAreaUm2: calculatePlotArea(project.site),
    maximumCoverageUm2: calculateMaximumCoverage(project.site),
    minimumEnvelope: calculateBuildableEnvelope(project.site, "minimum"),
    preferredEnvelope: calculateBuildableEnvelope(project.site, "preferred"),
  };
}

export function lengthUmToLegacyMm(value: LengthUm): number {
  return umToLegacyMm(value);
}

export function legacyAreaMm2ToUm2(value: number): AreaUm2 {
  return areaUm2(Math.round(value * 1_000_000));
}

export function setLegacySiteDimension(state: LegacyEditorStateV1, key: "width" | "depth", value: LengthUm): void {
  state.site[key] = umToLegacyMm(value);
}

export function readLegacySiteDimension(state: LegacyEditorStateV1, key: "width" | "depth"): LengthUm {
  return legacyMmToUm(state.site[key]);
}
