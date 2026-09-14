import type { AreaUm2, LengthUm } from "../core/units.js";
import { calculateBuildableEnvelope } from "../core/site.js";
import type { LegacyEditorStateV1, ProjectV2 } from "../project/schema.js";
export interface LegacyFoundationSummary {
    readonly plotAreaUm2: AreaUm2;
    readonly maximumCoverageUm2: AreaUm2;
    readonly minimumEnvelope: ReturnType<typeof calculateBuildableEnvelope>;
    readonly preferredEnvelope: ReturnType<typeof calculateBuildableEnvelope>;
}
export declare function foundationSummary(project: ProjectV2): LegacyFoundationSummary;
export declare function lengthUmToLegacyMm(value: LengthUm): number;
export declare function legacyAreaMm2ToUm2(value: number): AreaUm2;
export declare function setLegacySiteDimension(state: LegacyEditorStateV1, key: "width" | "depth", value: LengthUm): void;
export declare function readLegacySiteDimension(state: LegacyEditorStateV1, key: "width" | "depth"): LengthUm;
//# sourceMappingURL=legacy-adapter.d.ts.map