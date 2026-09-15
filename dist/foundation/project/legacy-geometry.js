/**
 * Compares only fields that describe legacy physical geometry. Presentation,
 * labels, coverage bookkeeping, and room semantics are intentionally excluded.
 */
export function legacyEditorGeometryEquals(left, right) {
    return left.site.width === right.site.width &&
        left.site.depth === right.site.depth &&
        equalArrays(left.rooms, right.rooms, roomGeometryEquals) &&
        equalArrays(left.walls, right.walls, wallGeometryEquals);
}
function roomGeometryEquals(left, right) {
    return left.id === right.id &&
        left.x === right.x &&
        left.y === right.y &&
        left.width === right.width &&
        left.height === right.height &&
        equalArrays(left.hiddenSides, right.hiddenSides, (leftSide, rightSide) => leftSide === rightSide);
}
function wallGeometryEquals(left, right) {
    return left.id === right.id &&
        left.x1 === right.x1 &&
        left.y1 === right.y1 &&
        left.x2 === right.x2 &&
        left.y2 === right.y2;
}
function equalArrays(left, right, equal) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
}
//# sourceMappingURL=legacy-geometry.js.map