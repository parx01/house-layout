import type { ProjectV2 } from "../project/schema.js";
import type { DerivedFaceVertex, FaceId } from "../spaces/model.js";
import { type ArchitecturalSpaceRole, type SemanticSpacesV2, type SpaceCategory, type SpaceEnclosure, type SpaceId } from "../spaces/semantic-model.js";
import { type NodeId, type TopologyV2, type WallId, type WallOrientation } from "../topology/model.js";
export declare const NODE_HIT_RADIUS_PX = 12;
export declare const WALL_MINIMUM_HIT_HALF_WIDTH_PX = 10;
export type CanonicalSelectableEntity = {
    readonly type: "space";
    readonly id: SpaceId;
} | {
    readonly type: "wall";
    readonly id: WallId;
} | {
    readonly type: "node";
    readonly id: NodeId;
};
export interface CanonicalSelectionState {
    readonly hovered: CanonicalSelectableEntity | null;
    readonly selected: CanonicalSelectableEntity | null;
}
export interface CanonicalSelectionRemap {
    readonly spaces?: Readonly<Record<string, SpaceId>>;
    readonly walls?: Readonly<Record<string, WallId>>;
    readonly nodes?: Readonly<Record<string, NodeId>>;
}
export interface SelectionHitPoint {
    readonly xUm: number;
    readonly yUm: number;
}
export interface SelectionViewportScale {
    readonly xUmPerCssPixel: number;
    readonly yUmPerCssPixel: number;
}
export interface SelectionHitWall {
    readonly id: WallId;
    readonly start: SelectionHitPoint;
    readonly end: SelectionHitPoint;
    readonly thicknessUm: number;
    readonly orientation: WallOrientation;
}
export interface SelectionHitNode extends SelectionHitPoint {
    readonly id: NodeId;
}
export interface SelectionHitSpace {
    readonly id: SpaceId;
    readonly faceId: FaceId;
    readonly vertices: readonly DerivedFaceVertex[];
}
export interface CanonicalHitTestModel {
    readonly walls: readonly SelectionHitWall[];
    readonly nodes: readonly SelectionHitNode[];
    readonly spaces: readonly SelectionHitSpace[];
}
export interface CanonicalHitTestResult {
    readonly entity: CanonicalSelectableEntity;
    readonly distancePx: number;
}
export type ResolvedCanonicalSelection = {
    readonly type: "space";
    readonly id: SpaceId;
    readonly name: string;
    readonly category: SpaceCategory;
    readonly architecturalRole: ArchitecturalSpaceRole;
    readonly enclosure: SpaceEnclosure;
    readonly faceId: FaceId;
} | {
    readonly type: "wall";
    readonly id: WallId;
    readonly orientation: WallOrientation;
    readonly lengthUm: number;
    readonly thicknessUm: number;
    readonly startNodeId: NodeId;
    readonly endNodeId: NodeId;
    readonly classification: "exterior" | "internalShared" | "nonFaceBoundary";
} | {
    readonly type: "node";
    readonly id: NodeId;
    readonly xUm: number;
    readonly yUm: number;
    readonly connectedWallIds: readonly WallId[];
    readonly degree: number;
};
export declare function createCanonicalSelectionState(): CanonicalSelectionState;
export declare function setHoveredEntity(state: CanonicalSelectionState, entity: CanonicalSelectableEntity | null): CanonicalSelectionState;
export declare function clearHoveredEntity(state: CanonicalSelectionState): CanonicalSelectionState;
export declare function selectCanonicalEntity(state: CanonicalSelectionState, entity: CanonicalSelectableEntity): CanonicalSelectionState;
export declare function clearCanonicalSelection(state: CanonicalSelectionState): CanonicalSelectionState;
export declare function createCanonicalHitTestModel(topologyValue: TopologyV2, spacesValue?: SemanticSpacesV2): CanonicalHitTestModel;
/** Deterministic node -> wall -> semantic-space hit testing in screen-normalized distance. */
export declare function hitTestCanonicalSelection(model: CanonicalHitTestModel, point: SelectionHitPoint, viewport: SelectionViewportScale): CanonicalHitTestResult | null;
export declare function reconcileCanonicalSelection(state: CanonicalSelectionState, projectValue: ProjectV2, remap?: CanonicalSelectionRemap): CanonicalSelectionState;
export declare function resolveCanonicalSelection(projectValue: ProjectV2, entity: CanonicalSelectableEntity | null): ResolvedCanonicalSelection | null;
//# sourceMappingURL=selection.d.ts.map