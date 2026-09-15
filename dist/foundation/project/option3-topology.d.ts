import { type LengthUm } from "../core/units.js";
import { type TopologyV2 } from "../topology/model.js";
/**
 * Curated Option-3 wall centre-lines in the ProjectV2 property coordinate
 * system. These are deliberately not a general legacy-rectangle migration.
 */
export declare const OPTION_3_TOPOLOGY_COORDINATES_UM: {
    readonly x: {
        readonly leftOuter: 1565700;
        readonly centralStep: 4788500;
        readonly rearPartitionLeft: 5701000;
        readonly rearPartitionMiddle: 7495500;
        readonly rearPartitionRight: 9299000;
        readonly frontPartitionLeft: 8255600;
        readonly frontPartitionRight: 9893900;
        readonly rightOuter: 13434300;
    };
    readonly y: {
        readonly rearOuter: 3165700;
        readonly rearWetRoomSplit: 6080350;
        readonly rearToCentral: 7909500;
        readonly pujaToKitchen: 9547800;
        readonly kitchenToStair: 12945500;
        readonly centralToFront: 14126500;
        readonly frontWetRoomSplit: 15650500;
        readonly stairOuter: 16050000;
        readonly frontOuter: 18870000;
    };
};
interface CuratedWallRun {
    readonly idSeed: string;
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
    readonly thicknessUm: LengthUm;
}
/**
 * Purpose-built physical runs observed in the Option-3 reference. Doorways are
 * retained as continuous host walls because opening subtraction is deferred.
 * Insertion order is part of the deterministic fixture contract.
 */
export declare const OPTION_3_CURATED_WALL_RUNS: readonly CuratedWallRun[];
export declare function createOption3TopologyV2(): TopologyV2;
export {};
//# sourceMappingURL=option3-topology.d.ts.map