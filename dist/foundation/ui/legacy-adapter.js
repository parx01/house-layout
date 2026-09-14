import { areaUm2, legacyMmToUm, umToLegacyMm } from "../core/units.js";
import { calculateBuildableEnvelope, calculateMaximumCoverage, calculatePlotArea } from "../core/site.js";
export function foundationSummary(project) {
    return {
        plotAreaUm2: calculatePlotArea(project.site),
        maximumCoverageUm2: calculateMaximumCoverage(project.site),
        minimumEnvelope: calculateBuildableEnvelope(project.site, "minimum"),
        preferredEnvelope: calculateBuildableEnvelope(project.site, "preferred"),
    };
}
export function lengthUmToLegacyMm(value) {
    return umToLegacyMm(value);
}
export function legacyAreaMm2ToUm2(value) {
    return areaUm2(Math.round(value * 1_000_000));
}
export function setLegacySiteDimension(state, key, value) {
    state.site[key] = umToLegacyMm(value);
}
export function readLegacySiteDimension(state, key) {
    return legacyMmToUm(state.site[key]);
}
//# sourceMappingURL=legacy-adapter.js.map