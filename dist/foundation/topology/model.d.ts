import { type CoordinateUm, type LengthUm } from "../core/units.js";
declare const nodeIdBrand: unique symbol;
declare const wallIdBrand: unique symbol;
export type NodeId = string & {
    readonly [nodeIdBrand]: "NodeId";
};
export type WallId = string & {
    readonly [wallIdBrand]: "WallId";
};
export interface TopologyNode {
    readonly id: NodeId;
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
}
/** A physical wall centre-line between two canonical junction nodes. */
export interface TopologyWall {
    readonly id: WallId;
    readonly startNodeId: NodeId;
    readonly endNodeId: NodeId;
    readonly thicknessUm: LengthUm;
}
export interface TopologyV2 {
    readonly status: "empty" | "active";
    readonly modelVersion: 1;
    readonly nodes: Record<NodeId, TopologyNode>;
    readonly walls: Record<WallId, TopologyWall>;
}
export type WallOrientation = "horizontal" | "vertical";
export declare const WALL_THICKNESS_4_5_IN_UM: LengthUm;
export declare const WALL_THICKNESS_9_IN_UM: LengthUm;
export declare function nodeId(value: string): NodeId;
export declare function wallId(value: string): WallId;
export declare function createEmptyTopologyV2(): TopologyV2;
export declare function getWallStartNode(topology: TopologyV2, id: WallId): TopologyNode;
export declare function getWallEndNode(topology: TopologyV2, id: WallId): TopologyNode;
export declare function getWallOrientation(topology: TopologyV2, id: WallId): WallOrientation;
export declare function getWallLength(topology: TopologyV2, id: WallId): LengthUm;
export declare function getConnectedWallIds(topology: TopologyV2, id: NodeId): WallId[];
export {};
//# sourceMappingURL=model.d.ts.map