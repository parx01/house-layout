import { deriveExteriorBoundary } from "./exterior-boundary.js";
import type { LengthUm } from "../core/units.js";
import type { DirectedWallHalfEdgeRef } from "../spaces/model.js";
import {
  getWallEndNode,
  getWallStartNode,
  type TopologyV2,
  type WallId,
} from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";

export class PhysicalExteriorEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhysicalExteriorEnvelopeError";
  }
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

interface OffsetWallFace extends PhysicalExteriorWallFace {
  readonly centreLineStart: PhysicalEnvelopePoint;
  readonly centreLineEnd: PhysicalEnvelopePoint;
}

interface ResolvedTransition {
  readonly previousEnd: PhysicalEnvelopePoint;
  readonly currentStart: PhysicalEnvelopePoint;
}

/**
 * Offsets A4-Core.1 exterior centre-lines to their physical outside faces.
 * This is a runtime derivation and never writes geometry into ProjectV2.
 */
export function derivePhysicalExteriorEnvelope(
  topologyValue: TopologyV2,
): DerivedPhysicalExteriorEnvelopeV1 {
  const topology = validateTopologyV2(topologyValue, "physicalExteriorEnvelope.topology");
  const exterior = deriveExteriorBoundary(topology);
  const loops = exterior.loops.map((loop) => deriveLoop(topology, loop.boundary));
  loops.sort((left, right) => left.geometryKey.localeCompare(right.geometryKey));
  return {
    modelVersion: 1,
    topologyModelVersion: 1,
    exteriorBoundaryModelVersion: 1,
    loops,
    geometryKey: loops.map((loop) => `[${loop.geometryKey}]`).join("|"),
  };
}

/** Compares only the physical outline, independent of topology identity. */
export function physicalExteriorEnvelopeGeometryEquals(
  left: DerivedPhysicalExteriorEnvelopeV1,
  right: DerivedPhysicalExteriorEnvelopeV1,
): boolean {
  return left.geometryKey === right.geometryKey;
}

function deriveLoop(
  topology: TopologyV2,
  boundary: readonly DirectedWallHalfEdgeRef[],
): PhysicalExteriorEnvelopeLoop {
  if (boundary.length < 4) throw new PhysicalExteriorEnvelopeError("Exterior loop has fewer than four walls.");
  const offsetFaces = boundary.map((reference) => offsetWallFace(topology, reference));
  const transitions = offsetFaces.map((current, index) =>
    resolveTransition(offsetFaces[(index - 1 + offsetFaces.length) % offsetFaces.length]!, current));
  const wallFaces = offsetFaces.map((face, index): PhysicalExteriorWallFace => ({
    wallId: face.wallId,
    direction: face.direction,
    thicknessUm: face.thicknessUm,
    start: transitions[index]!.currentStart,
    end: transitions[(index + 1) % transitions.length]!.previousEnd,
  }));
  const rawVertices: PhysicalEnvelopePoint[] = [];
  for (let index = 0; index < wallFaces.length; index += 1) {
    appendDistinct(rawVertices, wallFaces[index]!.start);
    appendDistinct(rawVertices, wallFaces[index]!.end);
    appendDistinct(rawVertices, transitions[(index + 1) % transitions.length]!.currentStart);
  }
  if (pointsEqual(rawVertices[0]!, rawVertices[rawVertices.length - 1]!)) rawVertices.pop();
  const vertices = canonicalizeVertices(removeRedundantCollinearVertices(rawVertices));
  assertValidOrthogonalLoop(vertices);
  const geometryKey = vertices.map(pointKey).join("|");
  return {
    winding: "clockwise",
    sourceBoundary: boundary.map((reference) => ({ ...reference })),
    wallFaces,
    vertices,
    geometryKey,
  };
}

function offsetWallFace(
  topology: TopologyV2,
  reference: DirectedWallHalfEdgeRef,
): OffsetWallFace {
  const wall = topology.walls[reference.wallId]!;
  const storedStart = getWallStartNode(topology, reference.wallId);
  const storedEnd = getWallEndNode(topology, reference.wallId);
  const startNode = reference.direction === "forward" ? storedStart : storedEnd;
  const endNode = reference.direction === "forward" ? storedEnd : storedStart;
  const centreLineStart = { xUm: startNode.xUm, yUm: startNode.yUm };
  const centreLineEnd = { xUm: endNode.xUm, yUm: endNode.yUm };
  const halfThicknessUm = wall.thicknessUm / 2;
  const dx = Math.sign(centreLineEnd.xUm - centreLineStart.xUm);
  const dy = Math.sign(centreLineEnd.yUm - centreLineStart.yUm);
  const offsetXUm = dy * halfThicknessUm;
  const offsetYUm = -dx * halfThicknessUm;
  return {
    wallId: wall.id,
    direction: reference.direction,
    thicknessUm: wall.thicknessUm,
    centreLineStart,
    centreLineEnd,
    start: { xUm: centreLineStart.xUm + offsetXUm, yUm: centreLineStart.yUm + offsetYUm },
    end: { xUm: centreLineEnd.xUm + offsetXUm, yUm: centreLineEnd.yUm + offsetYUm },
  };
}

function resolveTransition(previous: OffsetWallFace, current: OffsetWallFace): ResolvedTransition {
  if (!pointsEqual(previous.centreLineEnd, current.centreLineStart)) {
    throw new PhysicalExteriorEnvelopeError(
      `Exterior walls ${previous.wallId} and ${current.wallId} do not share a centre-line endpoint.`,
    );
  }
  const previousHorizontal = previous.start.yUm === previous.end.yUm;
  const currentHorizontal = current.start.yUm === current.end.yUm;
  if (previousHorizontal !== currentHorizontal) {
    const intersection = previousHorizontal
      ? { xUm: current.start.xUm, yUm: previous.end.yUm }
      : { xUm: previous.end.xUm, yUm: current.start.yUm };
    return { previousEnd: intersection, currentStart: intersection };
  }
  const previousDirection = direction(previous.centreLineStart, previous.centreLineEnd);
  const currentDirection = direction(current.centreLineStart, current.centreLineEnd);
  if (previousDirection.x !== currentDirection.x || previousDirection.y !== currentDirection.y) {
    throw new PhysicalExteriorEnvelopeError(
      `Exterior loop reverses direction between ${previous.wallId} and ${current.wallId}.`,
    );
  }
  return { previousEnd: previous.end, currentStart: current.start };
}

function direction(start: PhysicalEnvelopePoint, end: PhysicalEnvelopePoint): { x: number; y: number } {
  return { x: Math.sign(end.xUm - start.xUm), y: Math.sign(end.yUm - start.yUm) };
}

function appendDistinct(values: PhysicalEnvelopePoint[], point: PhysicalEnvelopePoint): void {
  if (!values.length || !pointsEqual(values[values.length - 1]!, point)) values.push(point);
}

function removeRedundantCollinearVertices(values: readonly PhysicalEnvelopePoint[]): PhysicalEnvelopePoint[] {
  const result = [...values];
  let changed = true;
  while (changed && result.length >= 4) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index - 1 + result.length) % result.length]!;
      const current = result[index]!;
      const next = result[(index + 1) % result.length]!;
      if (continuesStraight(previous, current, next)) {
        result.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

function continuesStraight(
  previous: PhysicalEnvelopePoint,
  current: PhysicalEnvelopePoint,
  next: PhysicalEnvelopePoint,
): boolean {
  const sameX = previous.xUm === current.xUm && current.xUm === next.xUm;
  const sameY = previous.yUm === current.yUm && current.yUm === next.yUm;
  if (!sameX && !sameY) return false;
  const firstDelta = sameX ? current.yUm - previous.yUm : current.xUm - previous.xUm;
  const secondDelta = sameX ? next.yUm - current.yUm : next.xUm - current.xUm;
  return firstDelta * secondDelta > 0;
}

function canonicalizeVertices(values: readonly PhysicalEnvelopePoint[]): PhysicalEnvelopePoint[] {
  if (!values.length) return [];
  let best = [...values];
  for (let index = 1; index < values.length; index += 1) {
    const candidate = [...values.slice(index), ...values.slice(0, index)];
    if (comparePointSequences(candidate, best) < 0) best = candidate;
  }
  return best;
}

function comparePointSequences(left: readonly PhysicalEnvelopePoint[], right: readonly PhysicalEnvelopePoint[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const xDifference = left[index]!.xUm - right[index]!.xUm;
    if (xDifference) return xDifference;
    const yDifference = left[index]!.yUm - right[index]!.yUm;
    if (yDifference) return yDifference;
  }
  return 0;
}

function assertValidOrthogonalLoop(vertices: readonly PhysicalEnvelopePoint[]): void {
  if (vertices.length < 4) throw new PhysicalExteriorEnvelopeError("Physical exterior loop has fewer than four vertices.");
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index]!;
    const end = vertices[(index + 1) % vertices.length]!;
    if (pointsEqual(start, end)) throw new PhysicalExteriorEnvelopeError("Physical exterior loop has a zero-length edge.");
    if (start.xUm !== end.xUm && start.yUm !== end.yUm) {
      throw new PhysicalExteriorEnvelopeError("Physical exterior loop contains a diagonal edge.");
    }
  }
  for (let leftIndex = 0; leftIndex < vertices.length; leftIndex += 1) {
    const leftStart = vertices[leftIndex]!;
    const leftEnd = vertices[(leftIndex + 1) % vertices.length]!;
    for (let rightIndex = leftIndex + 1; rightIndex < vertices.length; rightIndex += 1) {
      if (edgesAreAdjacent(leftIndex, rightIndex, vertices.length)) continue;
      const rightStart = vertices[rightIndex]!;
      const rightEnd = vertices[(rightIndex + 1) % vertices.length]!;
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        throw new PhysicalExteriorEnvelopeError("Physical exterior wall faces form a self-intersecting envelope.");
      }
    }
  }
}

function edgesAreAdjacent(left: number, right: number, count: number): boolean {
  return right === left + 1 || (left === 0 && right === count - 1);
}

function segmentsIntersect(
  leftStart: PhysicalEnvelopePoint,
  leftEnd: PhysicalEnvelopePoint,
  rightStart: PhysicalEnvelopePoint,
  rightEnd: PhysicalEnvelopePoint,
): boolean {
  const leftHorizontal = leftStart.yUm === leftEnd.yUm;
  const rightHorizontal = rightStart.yUm === rightEnd.yUm;
  if (leftHorizontal === rightHorizontal) {
    if (leftHorizontal && leftStart.yUm !== rightStart.yUm) return false;
    if (!leftHorizontal && leftStart.xUm !== rightStart.xUm) return false;
    const [leftMin, leftMax] = ordered(
      leftHorizontal ? leftStart.xUm : leftStart.yUm,
      leftHorizontal ? leftEnd.xUm : leftEnd.yUm,
    );
    const [rightMin, rightMax] = ordered(
      rightHorizontal ? rightStart.xUm : rightStart.yUm,
      rightHorizontal ? rightEnd.xUm : rightEnd.yUm,
    );
    return Math.max(leftMin, rightMin) <= Math.min(leftMax, rightMax);
  }
  const horizontalStart = leftHorizontal ? leftStart : rightStart;
  const horizontalEnd = leftHorizontal ? leftEnd : rightEnd;
  const verticalStart = leftHorizontal ? rightStart : leftStart;
  const verticalEnd = leftHorizontal ? rightEnd : leftEnd;
  const [horizontalMin, horizontalMax] = ordered(horizontalStart.xUm, horizontalEnd.xUm);
  const [verticalMin, verticalMax] = ordered(verticalStart.yUm, verticalEnd.yUm);
  return verticalStart.xUm >= horizontalMin && verticalStart.xUm <= horizontalMax &&
    horizontalStart.yUm >= verticalMin && horizontalStart.yUm <= verticalMax;
}

function ordered(left: number, right: number): readonly [number, number] {
  return left <= right ? [left, right] : [right, left];
}

function pointsEqual(left: PhysicalEnvelopePoint, right: PhysicalEnvelopePoint): boolean {
  return left.xUm === right.xUm && left.yUm === right.yUm;
}

function pointKey(point: PhysicalEnvelopePoint): string {
  return `${point.xUm},${point.yUm}`;
}
