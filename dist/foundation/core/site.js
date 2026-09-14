import { rectUm } from "./geometry.js";
import { areaUm2, feet, feetAndInches, lengthUm, } from "./units.js";
export const OPTION_3_SITE_WIDTH_UM = feetAndInches(49, 2);
export const OPTION_3_SITE_DEPTH_UM = feetAndInches(79, 2);
export function createOption3Site() {
    return {
        boundary: {
            kind: "rectangle",
            widthUm: OPTION_3_SITE_WIDTH_UM,
            depthUm: OPTION_3_SITE_DEPTH_UM,
        },
        frontEdgeIndex: 2,
        road: {
            edgeIndex: 2,
            label: "Road",
            widthUm: lengthUm(12_000_000),
        },
        orientation: {
            northAngleDeg: null,
            angleReference: "screenUp",
            positiveDirection: "clockwise",
        },
        coverageRule: {
            numerator: 66,
            denominator: 100,
            status: "userSuppliedUnverified",
        },
        designSetbacks: {
            status: "designTargetsNotRegulations",
            leftUm: feet(4),
            rightUm: feet(4),
            rearMinUm: feet(8),
            rearPreferredUm: feet(10),
            frontMinUm: null,
        },
    };
}
export function calculatePlotArea(site) {
    return areaUm2(site.boundary.widthUm * site.boundary.depthUm, "plot area");
}
export function calculateMaximumCoverage(site) {
    const plotArea = calculatePlotArea(site);
    const exact = (BigInt(plotArea) * BigInt(site.coverageRule.numerator)) / BigInt(site.coverageRule.denominator);
    return areaUm2(Number(exact), "maximum coverage");
}
export function calculateBuildableEnvelope(site, rearMode = "minimum") {
    const rear = rearMode === "preferred" ? site.designSetbacks.rearPreferredUm : site.designSetbacks.rearMinUm;
    const front = site.designSetbacks.frontMinUm ?? lengthUm(0);
    const width = site.boundary.widthUm - site.designSetbacks.leftUm - site.designSetbacks.rightUm;
    const depth = site.boundary.depthUm - rear - front;
    if (width <= 0 || depth <= 0)
        throw new RangeError("Design setbacks leave no buildable envelope.");
    return rectUm(site.designSetbacks.leftUm, rear, width, depth);
}
export function calculateClearances(site, footprint) {
    return {
        leftUm: lengthUm(Math.max(0, footprint.xUm)),
        rightUm: lengthUm(Math.max(0, site.boundary.widthUm - footprint.xUm - footprint.widthUm)),
        rearUm: lengthUm(Math.max(0, footprint.yUm)),
        frontUm: lengthUm(Math.max(0, site.boundary.depthUm - footprint.yUm - footprint.depthUm)),
    };
}
export function calculateSiteWarnings(site, footprint, footprintArea = null) {
    const warnings = [];
    if (footprint) {
        const outside = footprint.xUm < 0 ||
            footprint.yUm < 0 ||
            footprint.xUm + footprint.widthUm > site.boundary.widthUm ||
            footprint.yUm + footprint.depthUm > site.boundary.depthUm;
        if (outside) {
            warnings.push({
                category: "propertyBoundaryViolation",
                code: "footprintOutsidePropertyBoundary",
                message: "The candidate footprint extends outside the property boundary.",
                severity: "error",
            });
        }
        else {
            const clearances = calculateClearances(site, footprint);
            if (clearances.leftUm < site.designSetbacks.leftUm) {
                warnings.push(designWarning("leftDesignTargetNotMet", "The left-side design target is not met.", "warning"));
            }
            if (clearances.rightUm < site.designSetbacks.rightUm) {
                warnings.push(designWarning("rightDesignTargetNotMet", "The right-side design target is not met.", "warning"));
            }
            if (clearances.rearUm < site.designSetbacks.rearMinUm) {
                warnings.push(designWarning("rearMinimumDesignTargetNotMet", "The minimum rear design target is not met.", "warning"));
            }
            else if (clearances.rearUm < site.designSetbacks.rearPreferredUm) {
                warnings.push(designWarning("rearPreferredDesignTargetNotMet", "The preferred rear design target is not met.", "advisory"));
            }
            if (site.designSetbacks.frontMinUm !== null && clearances.frontUm < site.designSetbacks.frontMinUm) {
                warnings.push(designWarning("frontDesignTargetNotMet", "The front design target is not met.", "warning"));
            }
        }
    }
    if (footprintArea !== null && footprintArea > calculateMaximumCoverage(site)) {
        warnings.push({
            category: "coverageLimitViolation",
            code: "suppliedCoverageLimitExceeded",
            message: "The candidate footprint exceeds the supplied 66% coverage limit.",
            severity: "error",
        });
    }
    return warnings;
}
function designWarning(code, message, severity) {
    return { category: "designTargetViolation", code, message, severity };
}
//# sourceMappingURL=site.js.map