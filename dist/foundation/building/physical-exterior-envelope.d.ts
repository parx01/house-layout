import type { LengthUm } from "../core/units.js";
import type { DirectedWallHalfEdgeRef } from "../spaces/model.js";
import { type TopologyV2, type WallId } from "../topology/model.js";
export declare class PhysicalExteriorEnvelopeError extends Error {
    constructor(message: string);
}
export interface PhysicalEnvelopePoint {
    /** Exact to 0.5 µm because canonical wall thickness is an integer µm. */
    readonly xUm: number;
    readonly yUm: number;
}
export interface PhysicalExteriorWallFace {
    readonly wallId: WallId;
    readonly direction: "forward" | "reverse";
    readonly thicknessUm: LengthUm;
    /** Corner-resolved outer face, potentially extended to an orthogonal miter. */
    readonly start: PhysicalEnvelopePoint;
    readonly end: PhysicalEnvelopePoint;
}
export interface PhysicalExteriorEnvelopeLoop {
    readonly winding: "clockwise";
    readonly sourceBoundary: readonly DirectedWallHalfEdgeRef[];
    readonly wallFaces: readonly PhysicalExteriorWallFace[];
    /** Canonical physical outline; the final point connects back to the first. */
    readonly vertices: readonly PhysicalEnvelopePoint[];
    readonly geometryKey: string;
}
export interface DerivedPhysicalExteriorEnvelopeV1 {
    readonly modelVersion: 1;
    readonly topologyModelVersion: 1;
    readonly exteriorBoundaryModelVersion: 1;
    readonly loops: readonly PhysicalExteriorEnvelopeLoop[];
    /** Exact, deterministic geometry-only comparison key. */
    readonly geometryKey: string;
}
/**
 * Offsets A4-Core.1 exterior centre-lines to their physical outside faces.
 * This is a runtime derivation and never writes geometry into ProjectV2.
 */
export declare function derivePhysicalExteriorEnvelope(topologyValue: TopologyV2): DerivedPhysicalExteriorEnvelopeV1;
/** Compares only the physical outline, independent of topology identity. */
export declare function physicalExteriorEnvelopeGeometryEquals(left: DerivedPhysicalExteriorEnvelopeV1, right: DerivedPhysicalExteriorEnvelopeV1): boolean;
//# sourceMappingURL=physical-exterior-envelope.d.ts.map