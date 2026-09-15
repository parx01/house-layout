import { type TopologyV2 } from "../topology/model.js";
import { type DerivedFaceSetV1 } from "./model.js";
export declare class FaceExtractionError extends Error {
    constructor(message: string);
}
/**
 * Derives bounded planar faces from canonical wall centre-lines. Nothing is
 * persisted: topology remains the only geometric source of truth.
 */
export declare function extractBoundedFaces(topologyValue: TopologyV2): DerivedFaceSetV1;
//# sourceMappingURL=extract-faces.d.ts.map