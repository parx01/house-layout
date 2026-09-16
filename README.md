# Plan 66 house-plan editor

Plan 66 is being built as a **general-purpose orthogonal 2D floor-plan editor**. Option-3 is the current curated project, migration/reference source, and regression fixture; it is not the permanent product template.

The current browser experience still opens the Option-3 canonical physical-wall topology because that project is the engineering fixture used to build and verify the geometry foundation. The hard architectural requirement is that users will ultimately be able to create a new project from empty topology, draw/delete partitions and exterior walls, split/merge semantic spaces, edit wall thickness, reshape the footprint, and save/reload arbitrary orthogonal plans without depending on Option-3 IDs or assets.

See:

- `docs/general-floor-plan-editor-architecture.md` — accepted architectural decision and generalization requirements
- `docs/revised-a4-phase-b-roadmap.md` — current dependency order through generic project creation and topology authoring
- `docs/phase-b-polished-interaction-plan.md` — product interaction/authoring acceptance criteria.

## Current development fixture

At the current stage the visible plan is topology-native Option-3. Legacy rectangles remain compatibility/reference data and can be shown only through the optional comparison overlay.

## Open it

Serve the `dist` folder from a local web server, then open the printed local URL in Chrome. For example:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8765/`. Keep the entire `dist` folder together because the editor loads its compiled foundation, stylesheet, and preserved reference image from nearby files.

## Inspect the canonical plan

- Select semantic spaces, physical walls, and canonical junctions.
- Inspect wall classification, dimensions, thickness, semantic role/enclosure, and junction connectivity.
- Toggle **Legacy comparison** only when comparing the old rectangle tracing against canonical geometry.
- Zoom with the toolbar and scroll the drawing viewport independently when the plan is larger than the canvas.
- Drag a canonical wall perpendicular to its axis, or drag a canonical junction while the existing topology engine preserves orthogonality and connectivity. Each valid release is one undoable project change; Escape, pointer cancellation, invalid release, and semantic-remap-required results roll back exactly. Room/wall creation and deletion remain disabled.

The browser currently saves a strictly validated ProjectV2 document locally. ProjectV2 remains the historical Option-3 document contract. Before general topology authoring is considered complete, the roadmap requires a generic next-major project schema with an explicit ProjectV2 migration so blank/non-Option-3 projects do not inherit Option-3-only identity/recovery assumptions.

## Exact Option-3 site and supplied coverage limit

- Frontage: **49'2"**
- Depth: **79'2"**
- Plot area: **3,892.3611 sq ft**
- Supplied 66% maximum: **2,568.9583 sq ft**

These values belong to the Option-3 fixture, not to the editor globally.

The 66% figure is recorded as user-supplied and unverified. The future A4 coverage engine must consume a generic project policy rather than encode 66% as an algorithmic constant. The editable 4-ft side, 8-ft minimum rear, and 10-ft preferred rear values are design targets, not statutory setbacks.

The drawing itself labels the front road as 12.00 m wide, so ProjectV2 retains 12,000,000 µm with `referencePlanSuppliedUnverified` provenance. This is Option-3 metadata, not independent confirmation or a future generic-project default.

The visible historical **1,969.11 sq ft** covered-area number is a legacy rectangle-prototype estimate. It is not authoritative building geometry and is scheduled for retirement from normal coverage UI when A4-Coverage lands.

## Engineering structure

- `src/core`: branded integer units, geometry primitives, site calculations, design envelopes, and warning categories.
- `src/project`: project schemas/validation, canonical project transactions, and Option-3 fixture factories.
- `src/topology`: generic canonical node/wall graph, insertion/splitting, validation, and movement operations.
- `src/spaces`: generic derived bounded-face extraction, semantic identities/reconciliation, and architectural understanding.
- `src/building`: topology-derived exterior boundary, physical exterior envelope, and footprint-impact contracts.
- `src/interaction`: UI-independent transaction lifecycle and canonical selection/hit testing.
- `src/persistence`: version detection/migration/serialization and the current Option-3 browser-storage adapter.
- `src/ui`: topology-to-SVG rendering and legacy compatibility adapters.
- `fixtures`: immutable original Option-3 V1/reference assets used for migration/regression.
- `docs`: architectural decisions, roadmap, schema boundaries, topology/semantic design notes.
- `test`: unit/integration/regression coverage, increasingly including non-Option-3 synthetic topology.

Install dependencies once, then run:

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` compiles the TypeScript foundation to `dist/foundation`.

## Foundation history

A2.1 established the canonical internal node/wall topology graph and orthogonal wall model.

A2.2 added generic deterministic wall insertion, endpoint reuse, T/X junction canonicalization, segment splitting, and wall-ID remapping.

A2.3 curated the Option-3 physical wall graph through those generic operations; Option-3-specific coordinates live in fixture/project construction rather than the topology model.

A2.4 derives bounded faces from directed canonical wall half-edges. Faces and areas are runtime products rather than persisted room rectangles.

A2.5 adds perpendicular wall-run and orthogonality-preserving junction movement with validation.

A2.6/A2.6.1 made canonical topology authoritative independently of legacy rectangles and introduced validated project-level topology updates.

A3 introduced persistent semantic `SpaceId` identity, explicit architectural role/enclosure, safe face rebinding, split/merge ambiguity detection, and architectural understanding.

A4-Core derives true exterior walls, physical exterior wall-face envelopes, and transaction-level footprint impact without using semantic names or legacy rectangles.

B0 adds the immutable preview/commit/cancel interaction lifecycle. B1 adds runtime-only canonical space/wall/node selection with deterministic node → wall → space hit precedence.

The future path is **B2 movement → A4-Coverage → B3 typed dimensions → generic ProjectV3/new-project foundation → topology authoring → snapping → inspector/semantic editing → polish → blank-project real-use QA**.

B2 connects canonical wall and junction dragging to the B0 transaction lifecycle and A2.5 movement operations. Live candidates are rendered separately from the committed project, internal/exterior footprint metadata comes from A4-Core, and a successful gesture contributes exactly one undo/redo entry.

## Construction note

The supplied PDF and project metadata remain design/reference information. Property dimensions, permissions, setbacks, and regulations must be confirmed by a qualified architect and the relevant local authority before construction.
