import { type RectUm } from "./geometry.js";
import { type AreaUm2, type LengthUm } from "./units.js";
export type SiteWarningCategory = "propertyBoundaryViolation" | "coverageLimitViolation" | "designTargetViolation" | "regulatoryViolation";
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
export declare const OPTION_3_SITE_WIDTH_UM: LengthUm;
export declare const OPTION_3_SITE_DEPTH_UM: LengthUm;
export declare function createOption3Site(): SiteV2;
export declare function calculatePlotArea(site: SiteV2): AreaUm2;
export declare function calculateMaximumCoverage(site: SiteV2): AreaUm2;
export type RearEnvelopeMode = "minimum" | "preferred";
export declare function calculateBuildableEnvelope(site: SiteV2, rearMode?: RearEnvelopeMode): RectUm;
export interface SiteClearances {
    readonly leftUm: LengthUm;
    readonly rightUm: LengthUm;
    readonly rearUm: LengthUm;
    readonly frontUm: LengthUm;
}
export declare function calculateClearances(site: SiteV2, footprint: RectUm): SiteClearances;
export declare function calculateSiteWarnings(site: SiteV2, footprint: RectUm | null, footprintArea?: AreaUm2 | null): SiteWarning[];
//# sourceMappingURL=site.d.ts.map