import { formatSquareFeet, UM_PER_FOOT, UM_PER_INCH, type AreaUm2, type LengthUm } from "../core/units.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import type { DirectedWallHalfEdgeRef, FaceId } from "../spaces/model.js";
import {
  getConnectedWallIds,
  getWallEndNode,
  getWallLength,
  getWallStartNode,
  type NodeId,
  type TopologyV2,
  type WallId,
} from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";

const UM_PER_SVG_UNIT = 1_000;

export interface TopologySvgPoint {
  readonly nodeId: NodeId;
  readonly x: number;
  readonly y: number;
}

export interface TopologySvgFace {
  readonly id: FaceId;
  readonly points: readonly TopologySvgPoint[];
  readonly pointsAttribute: string;
  readonly boundary: readonly DirectedWallHalfEdgeRef[];
  readonly areaUm2: AreaUm2;
  readonly areaLabel: string;
  readonly labelX: number;
  readonly labelY: number;
}

export interface TopologySvgWall {
  readonly id: WallId;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly thicknessUm: LengthUm;
  readonly strokeWidth: number;
  readonly lengthUm: LengthUm;
  readonly lengthLabel: string;
  readonly thicknessLabel: string;
}

export interface TopologySvgJunction {
  readonly id: NodeId;
  readonly x: number;
  readonly y: number;
  readonly degree: number;
  readonly xLabel: string;
  readonly yLabel: string;
}

export interface TopologySvgRenderModel {
  readonly faces: readonly TopologySvgFace[];
  readonly walls: readonly TopologySvgWall[];
  readonly junctions: readonly TopologySvgJunction[];
  readonly ignoredBridgeWallIds: readonly WallId[];
  readonly excludedExteriorWalkCount: number;
}

/**
 * Pure adapter from canonical topology to SVG display data. Coordinates are
 * scaled from exact integer micrometres to the editor's millimetre viewBox;
 * no geometry is inferred from legacy room rectangles.
 */
export function createTopologySvgRenderModel(topologyValue: TopologyV2): TopologySvgRenderModel {
  const topology = validateTopologyV2(topologyValue, "topologyRenderModel");
  const derived = extractBoundedFaces(topology);
  const faces = derived.faces.map((face) => {
    const points = face.vertices.map((vertex) => ({
      nodeId: vertex.nodeId,
      x: svgUnits(vertex.xUm),
      y: svgUnits(vertex.yUm),
    }));
    const labelPoint = largestInteriorCellCenter(points);
    return {
      id: face.id,
      points,
      pointsAttribute: points.map((point) => `${point.x},${point.y}`).join(" "),
      boundary: face.boundary,
      areaUm2: face.areaUm2,
      areaLabel: formatSquareFeet(face.areaUm2, 1),
      labelX: labelPoint.x,
      labelY: labelPoint.y,
    };
  });

  const walls = Object.keys(topology.walls).sort().map((identity) => {
    const wall = topology.walls[identity as WallId]!;
    const start = getWallStartNode(topology, wall.id);
    const end = getWallEndNode(topology, wall.id);
    const wallLength = getWallLength(topology, wall.id);
    return {
      id: wall.id,
      startNodeId: wall.startNodeId,
      endNodeId: wall.endNodeId,
      x1: svgUnits(start.xUm),
      y1: svgUnits(start.yUm),
      x2: svgUnits(end.xUm),
      y2: svgUnits(end.yUm),
      thicknessUm: wall.thicknessUm,
      strokeWidth: svgUnits(wall.thicknessUm),
      lengthUm: wallLength,
      lengthLabel: formatPreciseArchitecturalLength(wallLength),
      thicknessLabel: formatPreciseArchitecturalLength(wall.thicknessUm),
    };
  });

  const junctions = Object.keys(topology.nodes).sort().map((identity) => {
    const node = topology.nodes[identity as NodeId]!;
    return {
      id: node.id,
      x: svgUnits(node.xUm),
      y: svgUnits(node.yUm),
      degree: getConnectedWallIds(topology, node.id).length,
      xLabel: formatCoordinate(node.xUm),
      yLabel: formatCoordinate(node.yUm),
    };
  });

  return {
    faces,
    walls,
    junctions,
    ignoredBridgeWallIds: derived.ignoredBridgeWallIds,
    excludedExteriorWalkCount: derived.excludedExteriorWalkCount,
  };
}

function svgUnits(valueUm: number): number {
  return valueUm / UM_PER_SVG_UNIT;
}

function formatCoordinate(valueUm: number): string {
  const magnitude = formatPreciseArchitecturalLength(Math.abs(valueUm));
  return valueUm < 0 ? `−${magnitude}` : magnitude;
}

function formatPreciseArchitecturalLength(valueUm: number): string {
  const feet = Math.floor(valueUm / UM_PER_FOOT);
  const inches = (valueUm - feet * UM_PER_FOOT) / UM_PER_INCH;
  const inchText = Number.isInteger(inches)
    ? String(inches)
    : inches.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return feet === 0 ? `${inchText}\"` : inches === 0 ? `${feet}'` : `${feet}'${inchText}\"`;
}

function largestInteriorCellCenter(points: readonly TopologySvgPoint[]): { x: number; y: number } {
  const xs = [...new Set(points.map((point) => point.x))].sort((left, right) => left - right);
  const ys = [...new Set(points.map((point) => point.y))].sort((left, right) => left - right);
  let best = { x: points[0]!.x, y: points[0]!.y, area: -1 };
  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const left = xs[xIndex]!;
      const right = xs[xIndex + 1]!;
      const top = ys[yIndex]!;
      const bottom = ys[yIndex + 1]!;
      const candidate = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const area = (right - left) * (bottom - top);
      if (area > best.area && pointInside(candidate, points)) best = { ...candidate, area };
    }
  }
  return { x: best.x, y: best.y };
}

function pointInside(point: { x: number; y: number }, polygon: readonly TopologySvgPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    if ((currentPoint.y > point.y) === (previousPoint.y > point.y)) continue;
    const intersectionX = previousPoint.x +
      ((point.y - previousPoint.y) * (currentPoint.x - previousPoint.x)) / (currentPoint.y - previousPoint.y);
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}
