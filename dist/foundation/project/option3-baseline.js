import { createOption3Site } from "../core/site.js";
import { legacyMmToUm, umToLegacyMm } from "../core/units.js";
import { legacyEditorGeometryEquals } from "./legacy-geometry.js";
import { createOption3SemanticSpacesV2 } from "./option3-semantic-spaces.js";
import { createOption3TopologyV2 } from "./option3-topology.js";
export const OPTION_3_REFERENCE_SHA256 = "56dbc61d59013c5f5247af5f684059097bb233da960379551b78c58f7ef01a37";
export const OPTION_3_V1_RECOVERY_STATE = {
    site: { width: 15000, depth: 24150, coverageLimit: 0.66 },
    commonAreaMm2: 15690428.0944,
    rooms: [
        { id: "bed-1", name: "Bedroom 1", x: 1680, y: 3280, width: 3964, height: 4572, included: true, hiddenSides: [] },
        { id: "toilet-1", name: "Toilet 1", x: 5758, y: 3280, width: 1680, height: 2857, included: true, hiddenSides: [] },
        { id: "dress-1", name: "Dress 1", x: 5758, y: 6138, width: 1680, height: 1715, included: true, hiddenSides: [] },
        { id: "toilet-2", name: "Toilet 2", x: 7553, y: 3280, width: 1689, height: 2857, included: true, hiddenSides: [] },
        { id: "dress-2", name: "Dress 2", x: 7553, y: 6138, width: 1689, height: 1715, included: true, hiddenSides: [] },
        { id: "bed-2", name: "Bedroom 2", x: 9356, y: 3280, width: 3964, height: 4572, included: true, hiddenSides: [] },
        { id: "puja", name: "Puja", x: 1680, y: 7967, width: 3166, height: 1640, included: true, hiddenSides: [] },
        { id: "kitchen", name: "Kitchen", x: 1680, y: 9608, width: 3166, height: 3280, included: true, hiddenSides: [] },
        { id: "stair", name: "Staircase", x: 1680, y: 13003, width: 3051, height: 3047, included: true, hiddenSides: [] },
        { id: "lobby", name: "Lobby / Dining", x: 4846, y: 7967, width: 8474, height: 6102, included: true, hiddenSides: [] },
        { id: "living", name: "Living Room", x: 4846, y: 14184, width: 3466, height: 4802, included: true, hiddenSides: [] },
        { id: "wash", name: "Wash Area", x: 8311, y: 14184, width: 1539, height: 1521, included: true, hiddenSides: [] },
        { id: "toilet-3", name: "Toilet 3", x: 8311, y: 15705, width: 1539, height: 3051, included: true, hiddenSides: [] },
        { id: "guest", name: "Guest Bedroom", x: 9965, y: 14184, width: 3355, height: 4572, included: true, hiddenSides: [] }
    ],
    walls: [],
    reference: { show: true, opacity: 0.28 },
    snap: true,
    showLabels: true
};
export function createOption3ProjectV2(legacyState) {
    const isUntouchedCuratedBaseline = legacyState === undefined;
    const sourceLegacyState = legacyState ?? OPTION_3_V1_RECOVERY_STATE;
    const hasCuratedTopology = isOption3BaselineLegacyGeometry(sourceLegacyState);
    const option3Site = createOption3Site();
    const normalizedLegacyState = structuredClone(sourceLegacyState);
    const hasKnownOption3Site = isKnownOption3LegacySite(sourceLegacyState);
    if (hasKnownOption3Site) {
        normalizedLegacyState.site.width = umToLegacyMm(option3Site.boundary.widthUm);
        normalizedLegacyState.site.depth = umToLegacyMm(option3Site.boundary.depthUm);
    }
    const site = hasKnownOption3Site ? option3Site : {
        ...option3Site,
        boundary: {
            ...option3Site.boundary,
            widthUm: legacyMmToUm(sourceLegacyState.site.width),
            depthUm: legacyMmToUm(sourceLegacyState.site.depth),
        },
    };
    return {
        schemaVersion: 2,
        schemaRevision: 6,
        projectId: "option-3",
        name: "OPTION-3 ground floor",
        units: "um",
        coordinateSystem: {
            origin: "rearLeftPropertyCorner",
            xAxis: "leftToRightWhenViewedWithFrontAtBottom",
            yAxis: "rearToFront",
            edgeIndexing: "clockwiseFromRear",
            geometryRotationPositive: "clockwiseInSvgView",
        },
        site,
        building: {
            status: hasCuratedTopology ? "topologyActive" : "topologyDeferred",
            coverageStatus: "deferredToExteriorEnvelopeA4",
        },
        topology: hasCuratedTopology ? createOption3TopologyV2() : deferredModel("A2"),
        spaces: hasCuratedTopology && isUntouchedCuratedBaseline
            ? createOption3SemanticSpacesV2()
            : deferredModel("A2"),
        openings: deferredModel("postA2"),
        dimensions: deferredModel("A2"),
        siteObjects: deferredModel("postA2"),
        legacyEditorState: normalizedLegacyState,
        recovery: {
            fixture: "fixtures/option-3-v1.json",
            referenceImage: "dist/assets/option-3-reference.png",
            referenceImageSha256: OPTION_3_REFERENCE_SHA256,
        },
    };
}
export function isOption3BaselineLegacyGeometry(legacyState) {
    if (!isKnownOption3LegacySite(legacyState))
        return false;
    const candidate = structuredClone(legacyState);
    const baseline = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    candidate.site.width = baseline.site.width;
    candidate.site.depth = baseline.site.depth;
    return legacyEditorGeometryEquals(candidate, baseline);
}
function isKnownOption3LegacySite(legacyState) {
    const exactSite = createOption3Site();
    return (legacyState.site.width === OPTION_3_V1_RECOVERY_STATE.site.width &&
        legacyState.site.depth === OPTION_3_V1_RECOVERY_STATE.site.depth) || (legacyState.site.width === umToLegacyMm(exactSite.boundary.widthUm) &&
        legacyState.site.depth === umToLegacyMm(exactSite.boundary.depthUm));
}
function deferredModel(targetStage) {
    return { status: "deferred", targetStage, modelVersion: null, data: null };
}
//# sourceMappingURL=option3-baseline.js.map