import type { LengthUm } from "../core/units.js";
import type { SiteV2 } from "../core/site.js";
import type { SemanticSpacesV1 } from "../spaces/semantic-model.js";
import type { TopologyV2 } from "../topology/model.js";
export interface LegacyRoomV1 {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    included: boolean;
    hiddenSides: Array<"top" | "right" | "bottom" | "left">;
}
export interface LegacyWallV1 {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
export interface LegacyEditorStateV1 {
    site: {
        width: number;
        depth: number;
        coverageLimit: number;
    };
    commonAreaMm2: number;
    rooms: LegacyRoomV1[];
    walls: LegacyWallV1[];
    reference: {
        show: boolean;
        opacity: number;
    };
    snap: boolean;
    showLabels: boolean;
}
export interface CoordinateSystemV2 {
    readonly origin: "rearLeftPropertyCorner";
    readonly xAxis: "leftToRightWhenViewedWithFrontAtBottom";
    readonly yAxis: "rearToFront";
    readonly edgeIndexing: "clockwiseFromRear";
    readonly geometryRotationPositive: "clockwiseInSvgView";
}
export type DeferredModelTargetStage = "A2" | "postA2";
/**
 * Stable ProjectV2 envelope for versioned geometry and semantic models. A2+
 * activate a slot with a separately validated modelVersion/data payload, but
 * must not add or reinterpret ProjectV2 top-level keys.
 */
export interface DeferredModelSlotV2 {
    readonly status: "deferred";
    readonly targetStage: DeferredModelTargetStage;
    readonly modelVersion: null;
    readonly data: null;
}
export interface ProjectV2 {
    readonly schemaVersion: 2;
    readonly schemaRevision: 5;
    readonly projectId: "option-3";
    readonly name: string;
    readonly units: "um";
    readonly coordinateSystem: CoordinateSystemV2;
    site: SiteV2;
    readonly building: {
        readonly status: "topologyActive" | "topologyDeferred";
        readonly coverageStatus: "deferredToExteriorEnvelopeA4";
    };
    readonly topology: DeferredModelSlotV2 | TopologyV2;
    readonly spaces: DeferredModelSlotV2 | SemanticSpacesV1;
    readonly openings: DeferredModelSlotV2;
    readonly dimensions: DeferredModelSlotV2;
    readonly siteObjects: DeferredModelSlotV2;
    legacyEditorState: LegacyEditorStateV1;
    readonly recovery: {
        readonly fixture: "fixtures/option-3-v1.json";
        readonly referenceImage: "dist/assets/option-3-reference.png";
        readonly referenceImageSha256: string;
    };
}
export interface LegacyProjectEnvelopeV1 extends LegacyEditorStateV1 {
    version?: 1;
    schemaVersion?: 1;
    savedAt?: string;
}
export interface LegacySiteAdapter {
    width: number;
    depth: number;
    coverageLimit: number;
}
export interface EditableDesignSetbacks {
    leftUm: LengthUm;
    rightUm: LengthUm;
    rearMinUm: LengthUm;
    rearPreferredUm: LengthUm;
    frontMinUm: LengthUm | null;
}
//# sourceMappingURL=schema.d.ts.map