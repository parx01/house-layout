import { type AreaUm2 } from "../core/units.js";
import { type FaceId } from "../spaces/model.js";
import { type ArchitecturalSpaceRole, type SemanticSpacesV2, type SpaceCategory, type SpaceEnclosure, type SpaceId } from "../spaces/semantic-model.js";
import type { WallId } from "../topology/model.js";
interface CuratedOption3SpaceBinding {
    readonly id: SpaceId;
    readonly name: string;
    readonly category: SpaceCategory;
    readonly architecturalRole: ArchitecturalSpaceRole;
    readonly enclosure: SpaceEnclosure;
    readonly faceId: FaceId;
    /** Curated audit note; never used to infer the binding. */
    readonly locationEvidence: string;
}
export interface Option3SemanticSpaceMappingRow extends CuratedOption3SpaceBinding {
    readonly areaUm2: AreaUm2;
    readonly areaLabel: string;
    readonly boundaryWallIds: readonly WallId[];
}
/**
 * Deliberate A3.2 bindings for the one curated Option-3 baseline. Face IDs are
 * literal references to the A2.4 output: this is not a geometry/name heuristic.
 */
export declare const OPTION_3_CURATED_SPACE_BINDINGS: readonly CuratedOption3SpaceBinding[];
export declare function createOption3SemanticSpacesV2(): SemanticSpacesV2;
/** @deprecated Use createOption3SemanticSpacesV2. The returned current model is V2. */
export declare const createOption3SemanticSpacesV1: typeof createOption3SemanticSpacesV2;
/** Derived audit rows. Areas and boundary references are never persisted. */
export declare function createOption3SemanticSpaceMappingRows(): readonly Option3SemanticSpaceMappingRow[];
export {};
//# sourceMappingURL=option3-semantic-spaces.d.ts.map