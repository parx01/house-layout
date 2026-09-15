import type { AreaUm2, LengthUm } from "../core/units.js";
import {
  getWallEndNode,
  getWallLength,
  getWallStartNode,
  type TopologyV2,
  type WallId,
} from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";
import { extractBoundedFaces } from "./extract-faces.js";
import type { DerivedBoundedFace, FaceId } from "./model.js";
import {
  validateSemanticSpacesV1,
  type SemanticSpacesV1,
  type SpaceCategory,
  type SpaceId,
} from "./semantic-model.js";

export interface ArchitecturalPoint {
  /** Exact to 0.25 µm; wall faces themselves are exact to 0.5 µm. */
  readonly xUm: number;
  readonly yUm: number;
}

export interface ArchitecturalWallUnderstanding {
  readonly wallId: WallId;
  readonly centreLineLengthUm: LengthUm;
  readonly thicknessUm: LengthUm;
}

export interface AdjacentSemanticSpace {
  readonly spaceId: SpaceId;
  readonly wallIds: readonly WallId[];
}

export interface SharedWallRelationship {
  readonly wallId: WallId;
  readonly spaceIds: readonly [SpaceId, SpaceId];
  readonly thicknessUm: LengthUm;
  readonly centreLineLengthUm: LengthUm;
}

export interface ClearDimensionSegment {
  readonly orientation: "horizontal" | "vertical";
  readonly lengthUm: number;
  readonly start: ArchitecturalPoint;
  readonly end: ArchitecturalPoint;
}

export type ClearGeometryUnderstanding =
  | {
      readonly status: "simpleRectangle";
      /** Clear wall-face to wall-face width, not a centre-line span. */
      readonly widthUm: number;
      /** Clear wall-face to wall-face depth, not a centre-line span. */
      readonly depthUm: number;
      readonly clearAreaUm2: number;
      readonly horizontalSegments: readonly ClearDimensionSegment[];
      readonly verticalSegments: readonly ClearDimensionSegment[];
    }
  | {
      readonly status: "notSimpleRectangle";
      readonly clearAreaUm2: number;
      readonly horizontalSegments: readonly ClearDimensionSegment[];
      readonly verticalSegments: readonly ClearDimensionSegment[];
    }
  | {
      readonly status: "noClearInterior";
      readonly clearAreaUm2: 0;
      readonly horizontalSegments: readonly [];
      readonly verticalSegments: readonly [];
    };

export interface SemanticSpaceUnderstanding {
  readonly spaceId: SpaceId;
  readonly name: string;
  readonly category: SpaceCategory;
  readonly faceId: FaceId;
  /** Exact centre-line face from A2.4. This is not clear usable floor geometry. */
  readonly face: DerivedBoundedFace;
  readonly centreLineAreaUm2: AreaUm2;
  readonly surroundingWallIds: readonly WallId[];
  readonly walls: readonly ArchitecturalWallUnderstanding[];
  readonly adjacentSpaces: readonly AdjacentSemanticSpace[];
  readonly boundaryWallIds: readonly WallId[];
  readonly clearGeometry: ClearGeometryUnderstanding;
  readonly labelAnchor: ArchitecturalPoint & {
    readonly basis: "largestClearInteriorRectangle" | "centreLineInteriorFallback";
  };
}

export interface ArchitecturalUnderstandingV1 {
  readonly modelVersion: 1;
  readonly topologyModelVersion: 1;
  readonly semanticModelVersion: 1;
  readonly spaces: readonly SemanticSpaceUnderstanding[];
  readonly sharedWalls: readonly SharedWallRelationship[];
  readonly unclaimedFaceIds: readonly FaceId[];
}

interface DoubledBounds {
  readonly left2: number;
  readonly right2: number;
  readonly top2: number;
  readonly bottom2: number;
}

interface ClearCell extends DoubledBounds {}

interface ClearRegion {
  readonly cells: readonly ClearCell[];
  readonly areaUm2: number;
  readonly bounds: DoubledBounds | null;
  readonly largestRectangle: DoubledBounds | null;
}

/**
 * Pure runtime derivation from canonical topology, A2.4 faces, and A3 spaces.
 * No result from this function is persisted as architectural source geometry.
 */
export function deriveArchitecturalUnderstanding(
  topologyValue: TopologyV2,
  spacesValue: SemanticSpacesV1,
): ArchitecturalUnderstandingV1 {
  const topology = validateTopologyV2(topologyValue, "architecturalUnderstanding.topology");
  const spaces = validateSemanticSpacesV1(spacesValue, topology, "architecturalUnderstanding.spaces");
  const faces = extractBoundedFaces(topology).faces;
  const facesById = new Map(faces.map((face) => [face.id, face]));
  const spacesByFaceId = new Map(spaces.spaces.map((space) => [space.faceId, space]));
  const faceIdsByWallId = indexFacesByWall(faces);
  const semanticSpaceIdsByWallId = new Map<WallId, SpaceId[]>();

  for (const [wallIdentity, faceIds] of faceIdsByWallId) {
    const semanticIds = faceIds
      .map((identity) => spacesByFaceId.get(identity)?.id)
      .filter((identity): identity is SpaceId => identity !== undefined)
      .sort();
    if (semanticIds.length > 2) {
      throw new Error(`Canonical wall ${wallIdentity} borders more than two semantic spaces.`);
    }
    semanticSpaceIdsByWallId.set(wallIdentity, semanticIds);
  }

  const understoodSpaces = spaces.spaces.map((space) => {
    const face = facesById.get(space.faceId)!;
    const surroundingWallIds = face.boundary.map((edge) => edge.wallId);
    const adjacentBySpaceId = new Map<SpaceId, WallId[]>();
    const boundaryWallIds: WallId[] = [];
    for (const wallIdentity of surroundingWallIds) {
      const adjacentIds = (semanticSpaceIdsByWallId.get(wallIdentity) ?? []).filter(
        (identity) => identity !== space.id,
      );
      if (adjacentIds.length === 0) {
        boundaryWallIds.push(wallIdentity);
        continue;
      }
      for (const adjacentId of adjacentIds) {
        const wallIds = adjacentBySpaceId.get(adjacentId) ?? [];
        wallIds.push(wallIdentity);
        adjacentBySpaceId.set(adjacentId, wallIds);
      }
    }

    const clearRegion = deriveClearRegion(topology, face);
    return {
      spaceId: space.id,
      name: space.name,
      category: space.category,
      faceId: space.faceId,
      face,
      centreLineAreaUm2: face.areaUm2,
      surroundingWallIds,
      walls: surroundingWallIds.map((wallIdentity) => ({
        wallId: wallIdentity,
        centreLineLengthUm: getWallLength(topology, wallIdentity),
        thicknessUm: topology.walls[wallIdentity]!.thicknessUm,
      })),
      adjacentSpaces: [...adjacentBySpaceId.entries()]
        .map(([spaceIdValue, wallIds]) => ({ spaceId: spaceIdValue, wallIds: [...wallIds].sort() }))
        .sort((left, right) => left.spaceId.localeCompare(right.spaceId)),
      boundaryWallIds: [...boundaryWallIds].sort(),
      clearGeometry: describeClearGeometry(clearRegion),
      labelAnchor: labelAnchor(face, clearRegion),
    } satisfies SemanticSpaceUnderstanding;
  });

  const sharedWalls = [...semanticSpaceIdsByWallId.entries()]
    .filter((entry): entry is [WallId, [SpaceId, SpaceId]] => entry[1].length === 2)
    .map(([wallIdentity, spaceIds]) => ({
      wallId: wallIdentity,
      spaceIds,
      thicknessUm: topology.walls[wallIdentity]!.thicknessUm,
      centreLineLengthUm: getWallLength(topology, wallIdentity),
    }))
    .sort((left, right) => left.wallId.localeCompare(right.wallId));
  const claimedFaceIds = new Set(spaces.spaces.map((space) => space.faceId));

  return {
    modelVersion: 1,
    topologyModelVersion: 1,
    semanticModelVersion: 1,
    spaces: understoodSpaces,
    sharedWalls,
    unclaimedFaceIds: faces.map((face) => face.id).filter((identity) => !claimedFaceIds.has(identity)).sort(),
  };
}

function indexFacesByWall(faces: readonly DerivedBoundedFace[]): Map<WallId, FaceId[]> {
  const result = new Map<WallId, FaceId[]>();
  for (const face of faces) {
    for (const edge of face.boundary) {
      const faceIds = result.get(edge.wallId) ?? [];
      faceIds.push(face.id);
      result.set(edge.wallId, faceIds);
    }
  }
  for (const faceIds of result.values()) faceIds.sort();
  return result;
}

function deriveClearRegion(topology: TopologyV2, face: DerivedBoundedFace): ClearRegion {
  const faceBounds = boundsOfFace(face);
  const bands = Object.keys(topology.walls)
    .sort()
    .map((identity) => wallBand(topology, identity as WallId))
    .filter((band) => boundsOverlap(band, faceBounds));
  const xs = uniqueSorted([
    ...face.vertices.map((point) => point.xUm * 2),
    ...bands.flatMap((band) => [band.left2, band.right2]),
  ]).filter((value) => value >= faceBounds.left2 && value <= faceBounds.right2);
  const ys = uniqueSorted([
    ...face.vertices.map((point) => point.yUm * 2),
    ...bands.flatMap((band) => [band.top2, band.bottom2]),
  ]).filter((value) => value >= faceBounds.top2 && value <= faceBounds.bottom2);
  const cells: ClearCell[] = [];
  const clearGrid: boolean[][] = Array.from({ length: xs.length - 1 }, () =>
    Array.from({ length: ys.length - 1 }, () => false),
  );
  let quarterArea = 0n;

  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const cell = { left2: xs[xIndex]!, right2: xs[xIndex + 1]!, top2: ys[yIndex]!, bottom2: ys[yIndex + 1]! };
      const x4 = cell.left2 + cell.right2;
      const y4 = cell.top2 + cell.bottom2;
      if (!pointInsideFaceQuarterUnits(face, x4, y4) || bands.some((band) => pointInsideBandQuarterUnits(band, x4, y4))) {
        continue;
      }
      clearGrid[xIndex]![yIndex] = true;
      cells.push(cell);
      quarterArea += BigInt(cell.right2 - cell.left2) * BigInt(cell.bottom2 - cell.top2);
    }
  }

  const areaNumerator = Number(quarterArea);
  if (!Number.isSafeInteger(areaNumerator)) throw new RangeError(`Clear area for face ${face.id} exceeds safe precision.`);
  const bounds = cells.length === 0 ? null : boundsOfCells(cells);
  return {
    cells,
    areaUm2: areaNumerator / 4,
    bounds,
    largestRectangle: largestClearRectangle(xs, ys, clearGrid),
  };
}

function describeClearGeometry(region: ClearRegion): ClearGeometryUnderstanding {
  if (!region.bounds || region.cells.length === 0) {
    return { status: "noClearInterior", clearAreaUm2: 0, horizontalSegments: [], verticalSegments: [] };
  }
  const boundsAreaQuarter =
    BigInt(region.bounds.right2 - region.bounds.left2) * BigInt(region.bounds.bottom2 - region.bounds.top2);
  if (Number(boundsAreaQuarter) / 4 === region.areaUm2) {
    return {
      status: "simpleRectangle",
      widthUm: (region.bounds.right2 - region.bounds.left2) / 2,
      depthUm: (region.bounds.bottom2 - region.bounds.top2) / 2,
      clearAreaUm2: region.areaUm2,
      horizontalSegments: [
        horizontalSegment(region.bounds.left2, region.bounds.right2, (region.bounds.top2 + region.bounds.bottom2) / 2),
      ],
      verticalSegments: [
        verticalSegment(region.bounds.top2, region.bounds.bottom2, (region.bounds.left2 + region.bounds.right2) / 2),
      ],
    };
  }
  return {
    status: "notSimpleRectangle",
    clearAreaUm2: region.areaUm2,
    horizontalSegments: dimensionSegments(region.cells, "horizontal"),
    verticalSegments: dimensionSegments(region.cells, "vertical"),
  };
}

function dimensionSegments(
  cells: readonly ClearCell[],
  orientation: "horizontal" | "vertical",
): ClearDimensionSegment[] {
  const grouped = new Map<string, ClearCell[]>();
  for (const cell of cells) {
    const key = orientation === "horizontal" ? `${cell.top2}:${cell.bottom2}` : `${cell.left2}:${cell.right2}`;
    const values = grouped.get(key) ?? [];
    values.push(cell);
    grouped.set(key, values);
  }
  const unique = new Map<string, ClearDimensionSegment>();
  for (const values of grouped.values()) {
    const sorted = [...values].sort((left, right) =>
      orientation === "horizontal" ? left.left2 - right.left2 : left.top2 - right.top2,
    );
    let runStart = sorted[0]!;
    let runEnd = sorted[0]!;
    const flush = (): void => {
      const segment = orientation === "horizontal"
        ? horizontalSegment(runStart.left2, runEnd.right2, (runStart.top2 + runStart.bottom2) / 2)
        : verticalSegment(runStart.top2, runEnd.bottom2, (runStart.left2 + runStart.right2) / 2);
      const key = `${segment.orientation}:${segment.start.xUm}:${segment.start.yUm}:${segment.end.xUm}:${segment.end.yUm}`;
      unique.set(key, segment);
    };
    for (const cell of sorted.slice(1)) {
      const contiguous = orientation === "horizontal" ? runEnd.right2 === cell.left2 : runEnd.bottom2 === cell.top2;
      if (!contiguous) {
        flush();
        runStart = cell;
      }
      runEnd = cell;
    }
    flush();
  }
  return [...unique.values()].sort((left, right) =>
    right.lengthUm - left.lengthUm ||
    left.start.yUm - right.start.yUm ||
    left.start.xUm - right.start.xUm ||
    left.end.yUm - right.end.yUm ||
    left.end.xUm - right.end.xUm,
  );
}

function horizontalSegment(left2: number, right2: number, y2: number): ClearDimensionSegment {
  return {
    orientation: "horizontal",
    lengthUm: (right2 - left2) / 2,
    start: { xUm: left2 / 2, yUm: y2 / 2 },
    end: { xUm: right2 / 2, yUm: y2 / 2 },
  };
}

function verticalSegment(top2: number, bottom2: number, x2: number): ClearDimensionSegment {
  return {
    orientation: "vertical",
    lengthUm: (bottom2 - top2) / 2,
    start: { xUm: x2 / 2, yUm: top2 / 2 },
    end: { xUm: x2 / 2, yUm: bottom2 / 2 },
  };
}

function labelAnchor(
  face: DerivedBoundedFace,
  region: ClearRegion,
): SemanticSpaceUnderstanding["labelAnchor"] {
  if (region.largestRectangle) {
    return {
      xUm: (region.largestRectangle.left2 + region.largestRectangle.right2) / 4,
      yUm: (region.largestRectangle.top2 + region.largestRectangle.bottom2) / 4,
      basis: "largestClearInteriorRectangle",
    };
  }
  const fallback = largestCentreLineCell(face);
  return { ...fallback, basis: "centreLineInteriorFallback" };
}

function largestClearRectangle(xs: readonly number[], ys: readonly number[], grid: readonly boolean[][]): DoubledBounds | null {
  let best: { bounds: DoubledBounds; area: bigint } | null = null;
  const prefix = clearCellPrefix(grid, xs.length - 1, ys.length - 1);
  for (let left = 0; left < xs.length - 1; left += 1) {
    for (let right = left + 1; right < xs.length; right += 1) {
      for (let top = 0; top < ys.length - 1; top += 1) {
        for (let bottom = top + 1; bottom < ys.length; bottom += 1) {
          if (!rectangleIsClear(prefix, left, right, top, bottom)) continue;
          const bounds = { left2: xs[left]!, right2: xs[right]!, top2: ys[top]!, bottom2: ys[bottom]! };
          const area = BigInt(bounds.right2 - bounds.left2) * BigInt(bounds.bottom2 - bounds.top2);
          if (!best || area > best.area || (area === best.area && compareBounds(bounds, best.bounds) < 0)) {
            best = { bounds, area };
          }
        }
      }
    }
  }
  return best?.bounds ?? null;
}

function rectangleIsClear(
  prefix: readonly (readonly number[])[],
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean {
  const clearCount = prefix[right]![bottom]! - prefix[left]![bottom]! - prefix[right]![top]! + prefix[left]![top]!;
  return clearCount === (right - left) * (bottom - top);
}

function clearCellPrefix(
  grid: readonly boolean[][],
  width: number,
  height: number,
): readonly (readonly number[])[] {
  const prefix = Array.from({ length: width + 1 }, () => Array.from({ length: height + 1 }, () => 0));
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      prefix[x + 1]![y + 1] =
        (grid[x]?.[y] ? 1 : 0) + prefix[x]![y + 1]! + prefix[x + 1]![y]! - prefix[x]![y]!;
    }
  }
  return prefix;
}

function compareBounds(left: DoubledBounds, right: DoubledBounds): number {
  return left.top2 - right.top2 || left.left2 - right.left2 || left.bottom2 - right.bottom2 || left.right2 - right.right2;
}

function largestCentreLineCell(face: DerivedBoundedFace): ArchitecturalPoint {
  const xs = uniqueSorted(face.vertices.map((point) => point.xUm * 2));
  const ys = uniqueSorted(face.vertices.map((point) => point.yUm * 2));
  let best: { point: ArchitecturalPoint; area: bigint } | null = null;
  for (let x = 0; x < xs.length - 1; x += 1) {
    for (let y = 0; y < ys.length - 1; y += 1) {
      const x4 = xs[x]! + xs[x + 1]!;
      const y4 = ys[y]! + ys[y + 1]!;
      if (!pointInsideFaceQuarterUnits(face, x4, y4)) continue;
      const area = BigInt(xs[x + 1]! - xs[x]!) * BigInt(ys[y + 1]! - ys[y]!);
      const point = { xUm: x4 / 4, yUm: y4 / 4 };
      if (!best || area > best.area || (area === best.area && comparePoint(point, best.point) < 0)) best = { point, area };
    }
  }
  if (!best) throw new Error(`Face ${face.id} has no deterministic interior label position.`);
  return best.point;
}

function comparePoint(left: ArchitecturalPoint, right: ArchitecturalPoint): number {
  return left.yUm - right.yUm || left.xUm - right.xUm;
}

function boundsOfFace(face: DerivedBoundedFace): DoubledBounds {
  return {
    left2: Math.min(...face.vertices.map((point) => point.xUm)) * 2,
    right2: Math.max(...face.vertices.map((point) => point.xUm)) * 2,
    top2: Math.min(...face.vertices.map((point) => point.yUm)) * 2,
    bottom2: Math.max(...face.vertices.map((point) => point.yUm)) * 2,
  };
}

function boundsOfCells(cells: readonly ClearCell[]): DoubledBounds {
  return {
    left2: Math.min(...cells.map((cell) => cell.left2)),
    right2: Math.max(...cells.map((cell) => cell.right2)),
    top2: Math.min(...cells.map((cell) => cell.top2)),
    bottom2: Math.max(...cells.map((cell) => cell.bottom2)),
  };
}

function wallBand(topology: TopologyV2, wallIdentity: WallId): DoubledBounds {
  const wall = topology.walls[wallIdentity]!;
  const start = getWallStartNode(topology, wallIdentity);
  const end = getWallEndNode(topology, wallIdentity);
  if (start.yUm === end.yUm) {
    return {
      left2: Math.min(start.xUm, end.xUm) * 2,
      right2: Math.max(start.xUm, end.xUm) * 2,
      top2: start.yUm * 2 - wall.thicknessUm,
      bottom2: start.yUm * 2 + wall.thicknessUm,
    };
  }
  return {
    left2: start.xUm * 2 - wall.thicknessUm,
    right2: start.xUm * 2 + wall.thicknessUm,
    top2: Math.min(start.yUm, end.yUm) * 2,
    bottom2: Math.max(start.yUm, end.yUm) * 2,
  };
}

function boundsOverlap(left: DoubledBounds, right: DoubledBounds): boolean {
  return left.left2 < right.right2 && left.right2 > right.left2 && left.top2 < right.bottom2 && left.bottom2 > right.top2;
}

function pointInsideBandQuarterUnits(bounds: DoubledBounds, x4: number, y4: number): boolean {
  return x4 > bounds.left2 * 2 && x4 < bounds.right2 * 2 && y4 > bounds.top2 * 2 && y4 < bounds.bottom2 * 2;
}

function pointInsideFaceQuarterUnits(face: DerivedBoundedFace, x4: number, y4: number): boolean {
  let inside = false;
  for (let index = 0; index < face.vertices.length; index += 1) {
    const start = face.vertices[index]!;
    const end = face.vertices[(index + 1) % face.vertices.length]!;
    if (start.xUm !== end.xUm) continue;
    const minY4 = Math.min(start.yUm, end.yUm) * 4;
    const maxY4 = Math.max(start.yUm, end.yUm) * 4;
    if (y4 > minY4 && y4 < maxY4 && start.xUm * 4 > x4) inside = !inside;
  }
  return inside;
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}
