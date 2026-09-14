import { coordinateUm, lengthUm } from "../../src/core/units.js";
import {
  WALL_THICKNESS_4_5_IN_UM,
  WALL_THICKNESS_9_IN_UM,
  nodeId,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../../src/topology/model.js";

function node(idValue: string, xUm: number, yUm: number): TopologyNode {
  return { id: nodeId(idValue), xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) };
}

function wall(idValue: string, start: string, end: string, thicknessUm = WALL_THICKNESS_9_IN_UM): TopologyWall {
  return {
    id: wallId(idValue),
    startNodeId: nodeId(start),
    endNodeId: nodeId(end),
    thicknessUm: lengthUm(thicknessUm),
  };
}

function nodeRecord(values: TopologyNode[]): Record<NodeId, TopologyNode> {
  return Object.fromEntries(values.map((value) => [value.id, value])) as Record<NodeId, TopologyNode>;
}

function wallRecord(values: TopologyWall[]): Record<WallId, TopologyWall> {
  return Object.fromEntries(values.map((value) => [value.id, value])) as Record<WallId, TopologyWall>;
}

export function rectangleTopology(): TopologyV2 {
  return {
    status: "active",
    modelVersion: 1,
    nodes: nodeRecord([
      node("n-1", 0, 0),
      node("n-2", 4_000_000, 0),
      node("n-3", 4_000_000, 3_000_000),
      node("n-4", 0, 3_000_000),
    ]),
    walls: wallRecord([
      wall("w-top", "n-1", "n-2"),
      wall("w-right", "n-2", "n-3"),
      wall("w-bottom", "n-3", "n-4"),
      wall("w-left", "n-4", "n-1"),
    ]),
  };
}

export function twoRoomSharedWallTopology(): TopologyV2 {
  return {
    status: "active",
    modelVersion: 1,
    nodes: nodeRecord([
      node("n-1", 0, 0),
      node("n-2", 3_000_000, 0),
      node("n-3", 6_000_000, 0),
      node("n-4", 6_000_000, 4_000_000),
      node("n-5", 3_000_000, 4_000_000),
      node("n-6", 0, 4_000_000),
    ]),
    walls: wallRecord([
      wall("w-top-left", "n-1", "n-2"),
      wall("w-top-right", "n-2", "n-3"),
      wall("w-right", "n-3", "n-4"),
      wall("w-bottom-right", "n-4", "n-5"),
      wall("w-bottom-left", "n-5", "n-6"),
      wall("w-left", "n-6", "n-1"),
      wall("w-shared", "n-2", "n-5", WALL_THICKNESS_4_5_IN_UM),
    ]),
  };
}

export function fourWayJunctionTopology(): TopologyV2 {
  return {
    status: "active",
    modelVersion: 1,
    nodes: nodeRecord([
      node("n-center", 0, 0),
      node("n-north", 0, -1_000_000),
      node("n-east", 1_000_000, 0),
      node("n-south", 0, 1_000_000),
      node("n-west", -1_000_000, 0),
    ]),
    walls: wallRecord([
      wall("w-north", "n-center", "n-north"),
      wall("w-east", "n-center", "n-east"),
      wall("w-south", "n-center", "n-south"),
      wall("w-west", "n-center", "n-west"),
    ]),
  };
}
