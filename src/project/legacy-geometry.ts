import type { LegacyEditorStateV1, LegacyRoomV1, LegacyWallV1 } from "./schema.js";

/**
 * Compares only fields that describe legacy physical geometry. Presentation,
 * labels, coverage bookkeeping, and room semantics are intentionally excluded.
 */
export function legacyEditorGeometryEquals(
  left: LegacyEditorStateV1,
  right: LegacyEditorStateV1,
): boolean {
  return left.site.width === right.site.width &&
    left.site.depth === right.site.depth &&
    equalArrays(left.rooms, right.rooms, roomGeometryEquals) &&
    equalArrays(left.walls, right.walls, wallGeometryEquals);
}

function roomGeometryEquals(left: LegacyRoomV1, right: LegacyRoomV1): boolean {
  return left.id === right.id &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    equalArrays(left.hiddenSides, right.hiddenSides, (leftSide, rightSide) => leftSide === rightSide);
}

function wallGeometryEquals(left: LegacyWallV1, right: LegacyWallV1): boolean {
  return left.id === right.id &&
    left.x1 === right.x1 &&
    left.y1 === right.y1 &&
    left.x2 === right.x2 &&
    left.y2 === right.y2;
}

function equalArrays<T>(left: readonly T[], right: readonly T[], equal: (left: T, right: T) => boolean): boolean {
  return left.length === right.length && left.every((value, index) => equal(value, right[index]!));
}
