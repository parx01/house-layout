import type { LegacyEditorStateV1 } from "./schema.js";
/**
 * Compares only fields that describe legacy physical geometry. Presentation,
 * labels, coverage bookkeeping, and room semantics are intentionally excluded.
 */
export declare function legacyEditorGeometryEquals(left: LegacyEditorStateV1, right: LegacyEditorStateV1): boolean;
//# sourceMappingURL=legacy-geometry.d.ts.map