import type { LengthUm } from "../core/units.js";
import type { SiteV2 } from "../core/site.js";
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
export interface ProjectV2 {
    readonly schemaVersion: 2;
    readonly projectId: "option-3";
    readonly name: string;
    readonly units: "um";
    readonly coordinateSystem: CoordinateSystemV2;
    site: SiteV2;
    readonly building: {
        readonly status: "deferredToTopologyA2";
        readonly coverageStatus: "deferredToExteriorEnvelopeA4";
    };
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