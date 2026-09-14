import { rectUm, type RectUm } from "./geometry.js";
import {
  areaUm2,
  feet,
  feetAndInches,
  lengthUm,
  type AreaUm2,
  type LengthUm,
} from "./units.js";

export type SiteWarningCategory =
  | "propertyBoundaryViolation"
  | "coverageLimitViolation"
  | "designTargetViolation"
  | "regulatoryViolation";

export interface SiteWarning {
  readonly category: SiteWarningCategory;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning" | "advisory";
}

export interface SiteV2 {
  readonly boundary: {
    readonly kind: "rectangle";
    readonly widthUm: LengthUm;
    readonly depthUm: LengthUm;
  };
  readonly frontEdgeIndex: 0 | 1 | 2 | 3;
  readonly road: {
    readonly edgeIndex: 0 | 1 | 2 | 3;
    readonly label: string;
    readonly widthUm: LengthUm | null;
    readonly widthProvenance:
      | {
          readonly kind: "referencePlanSuppliedUnverified";
          readonly sourceDocument: "OPTION-3.pdf";
          readonly sourceLabel: "ROAD 12.00M WIDE";
        }
      | {
          readonly kind: "legacyProjectUnverified";
          readonly sourceDocument: null;
          readonly sourceLabel: null;
        }
      | null;
  };
  readonly orientation: {
    readonly northAngleDeg: number | null;
    readonly angleReference: "screenUp";
    readonly positiveDirection: "clockwise";
  };
  readonly coverageRule: {
    readonly numerator: 66;
    readonly denominator: 100;
    readonly status: "userSuppliedUnverified";
  };
  readonly designSetbacks: {
    readonly status: "designTargetsNotRegulations";
    leftUm: LengthUm;
    rightUm: LengthUm;
    rearMinUm: LengthUm;
    rearPreferredUm: LengthUm;
    frontMinUm: LengthUm | null;
  };
}

export const OPTION_3_SITE_WIDTH_UM = feetAndInches(49, 2);
export const OPTION_3_SITE_DEPTH_UM = feetAndInches(79, 2);

export function createOption3Site(): SiteV2 {
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
      widthProvenance: {
        kind: "referencePlanSuppliedUnverified",
        sourceDocument: "OPTION-3.pdf",
        sourceLabel: "ROAD 12.00M WIDE",
      },
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

export function calculatePlotArea(site: SiteV2): AreaUm2 {
  return areaUm2(site.boundary.widthUm * site.boundary.depthUm, "plot area");
}

export function calculateMaximumCoverage(site: SiteV2): AreaUm2 {
  const plotArea = calculatePlotArea(site);
  const exact = (BigInt(plotArea) * BigInt(site.coverageRule.numerator)) / BigInt(site.coverageRule.denominator);
  return areaUm2(Number(exact), "maximum coverage");
}

export type RearEnvelopeMode = "minimum" | "preferred";

export function calculateBuildableEnvelope(site: SiteV2, rearMode: RearEnvelopeMode = "minimum"): RectUm {
  const rear = rearMode === "preferred" ? site.designSetbacks.rearPreferredUm : site.designSetbacks.rearMinUm;
  const front = site.designSetbacks.frontMinUm ?? lengthUm(0);
  const width = site.boundary.widthUm - site.designSetbacks.leftUm - site.designSetbacks.rightUm;
  const depth = site.boundary.depthUm - rear - front;
  if (width <= 0 || depth <= 0) throw new RangeError("Design setbacks leave no buildable envelope.");
  return rectUm(site.designSetbacks.leftUm, rear, width, depth);
}

export interface SiteClearances {
  readonly leftUm: LengthUm;
  readonly rightUm: LengthUm;
  readonly rearUm: LengthUm;
  readonly frontUm: LengthUm;
}

export function calculateClearances(site: SiteV2, footprint: RectUm): SiteClearances {
  return {
    leftUm: lengthUm(Math.max(0, footprint.xUm)),
    rightUm: lengthUm(Math.max(0, site.boundary.widthUm - footprint.xUm - footprint.widthUm)),
    rearUm: lengthUm(Math.max(0, footprint.yUm)),
    frontUm: lengthUm(Math.max(0, site.boundary.depthUm - footprint.yUm - footprint.depthUm)),
  };
}

export function calculateSiteWarnings(
  site: SiteV2,
  footprint: RectUm | null,
  footprintArea: AreaUm2 | null = null,
): SiteWarning[] {
  const warnings: SiteWarning[] = [];
  if (footprint) {
    const outside =
      footprint.xUm < 0 ||
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
    } else {
      const clearances = calculateClearances(site, footprint);
      if (clearances.leftUm < site.designSetbacks.leftUm) {
        warnings.push(designWarning("leftDesignTargetNotMet", "The left-side design target is not met.", "warning"));
      }
      if (clearances.rightUm < site.designSetbacks.rightUm) {
        warnings.push(designWarning("rightDesignTargetNotMet", "The right-side design target is not met.", "warning"));
      }
      if (clearances.rearUm < site.designSetbacks.rearMinUm) {
        warnings.push(designWarning("rearMinimumDesignTargetNotMet", "The minimum rear design target is not met.", "warning"));
      } else if (clearances.rearUm < site.designSetbacks.rearPreferredUm) {
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

function designWarning(code: string, message: string, severity: "warning" | "advisory"): SiteWarning {
  return { category: "designTargetViolation", code, message, severity };
}
