import { coordinateUm } from "../core/units.js";
import { createEmptyTopologyV2, WALL_THICKNESS_4_5_IN_UM, WALL_THICKNESS_9_IN_UM, } from "../topology/model.js";
import { insertWall } from "../topology/operations.js";
import { validateTopologyV2 } from "../topology/validation.js";
/**
 * Curated Option-3 wall centre-lines in the ProjectV2 property coordinate
 * system. These are deliberately not a general legacy-rectangle migration.
 */
export const OPTION_3_TOPOLOGY_COORDINATES_UM = {
    x: {
        leftOuter: 1_565_700,
        centralStep: 4_788_500,
        rearPartitionLeft: 5_701_000,
        rearPartitionMiddle: 7_495_500,
        rearPartitionRight: 9_299_000,
        frontPartitionLeft: 8_255_600,
        frontPartitionRight: 9_893_900,
        rightOuter: 13_434_300,
    },
    y: {
        rearOuter: 3_165_700,
        rearWetRoomSplit: 6_080_350,
        rearToCentral: 7_909_500,
        pujaToKitchen: 9_547_800,
        kitchenToStair: 12_945_500,
        centralToFront: 14_126_500,
        frontWetRoomSplit: 15_650_500,
        stairOuter: 16_050_000,
        frontOuter: 18_870_000,
    },
};
const { x, y } = OPTION_3_TOPOLOGY_COORDINATES_UM;
/**
 * Purpose-built physical runs observed in the Option-3 reference. Doorways are
 * retained as continuous host walls because opening subtraction is deferred.
 * Insertion order is part of the deterministic fixture contract.
 */
export const OPTION_3_CURATED_WALL_RUNS = [
    run("rear-outer", x.leftOuter, y.rearOuter, x.rightOuter, y.rearOuter, WALL_THICKNESS_9_IN_UM),
    run("right-outer", x.rightOuter, y.rearOuter, x.rightOuter, y.frontOuter, WALL_THICKNESS_9_IN_UM),
    run("rear-central", x.leftOuter, y.rearToCentral, x.rightOuter, y.rearToCentral, WALL_THICKNESS_4_5_IN_UM),
    run("central-front", x.centralStep, y.centralToFront, x.rightOuter, y.centralToFront, WALL_THICKNESS_4_5_IN_UM),
    run("front-outer", x.centralStep, y.frontOuter, x.rightOuter, y.frontOuter, WALL_THICKNESS_9_IN_UM),
    run("left-outer", x.leftOuter, y.rearOuter, x.leftOuter, y.stairOuter, WALL_THICKNESS_9_IN_UM),
    run("stair-outer", x.leftOuter, y.stairOuter, x.centralStep, y.stairOuter, WALL_THICKNESS_9_IN_UM),
    run("central-step", x.centralStep, y.pujaToKitchen, x.centralStep, y.frontOuter, WALL_THICKNESS_4_5_IN_UM),
    run("puja-kitchen", x.leftOuter, y.pujaToKitchen, x.centralStep, y.pujaToKitchen, WALL_THICKNESS_4_5_IN_UM),
    run("kitchen-stair", x.leftOuter, y.kitchenToStair, x.centralStep, y.kitchenToStair, WALL_THICKNESS_4_5_IN_UM),
    run("rear-partition-left", x.rearPartitionLeft, y.rearOuter, x.rearPartitionLeft, y.rearToCentral, WALL_THICKNESS_4_5_IN_UM),
    run("rear-partition-middle", x.rearPartitionMiddle, y.rearOuter, x.rearPartitionMiddle, y.rearToCentral, WALL_THICKNESS_4_5_IN_UM),
    run("rear-partition-right", x.rearPartitionRight, y.rearOuter, x.rearPartitionRight, y.rearToCentral, WALL_THICKNESS_4_5_IN_UM),
    run("rear-wet-split", x.rearPartitionLeft, y.rearWetRoomSplit, x.rearPartitionRight, y.rearWetRoomSplit, WALL_THICKNESS_4_5_IN_UM),
    run("front-partition-left", x.frontPartitionLeft, y.centralToFront, x.frontPartitionLeft, y.frontOuter, WALL_THICKNESS_4_5_IN_UM),
    run("front-partition-right", x.frontPartitionRight, y.centralToFront, x.frontPartitionRight, y.frontOuter, WALL_THICKNESS_4_5_IN_UM),
    run("front-wet-split", x.frontPartitionLeft, y.frontWetRoomSplit, x.frontPartitionRight, y.frontWetRoomSplit, WALL_THICKNESS_4_5_IN_UM),
];
export function createOption3TopologyV2() {
    let topology = createEmptyTopologyV2();
    for (const wallRun of OPTION_3_CURATED_WALL_RUNS) {
        topology = insertWall(topology, proposal(wallRun), { idSeed: `option3-${wallRun.idSeed}` }).topology;
    }
    return validateTopologyV2(topology, "option3.topology");
}
function run(idSeed, x1, y1, x2, y2, thicknessUm) {
    return { idSeed, start: [x1, y1], end: [x2, y2], thicknessUm };
}
function proposal(wallRun) {
    return {
        start: { xUm: coordinateUm(wallRun.start[0]), yUm: coordinateUm(wallRun.start[1]) },
        end: { xUm: coordinateUm(wallRun.end[0]), yUm: coordinateUm(wallRun.end[1]) },
        thicknessUm: wallRun.thicknessUm,
    };
}
//# sourceMappingURL=option3-topology.js.map