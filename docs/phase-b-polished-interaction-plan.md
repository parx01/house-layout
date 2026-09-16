# Phase B — General Floor-Plan Interaction & Authoring Plan

## Product target

Phase B turns the trustworthy geometry built in A2–A4 into a genuine **general-purpose orthogonal floor-plan editor**.

The target is Figma/Rayon-like ease for house planning, not CAD/BIM complexity: direct manipulation, exact architectural dimensions, wall/partition authoring, explicit room semantics, minimal controls, strong feedback, and safe experimentation.

Option-3 remains the main detailed regression fixture, but Phase B is not complete if users can only modify the walls that Option-3 already contains.

See `docs/general-floor-plan-editor-architecture.md` for the hard architectural requirement.

## Product boundary for this phase

Supported initially:

- desktop-first 2D editing
- one floor
- rectangular site boundary
- horizontal/vertical walls only
- exact wall thickness
- arbitrary valid orthogonal room/space arrangements
- new projects starting from empty topology.

Still out of scope unless separately scheduled:

- diagonal/curved walls
- multi-floor workflows
- structural engineering
- BIM
- MEP
- 3D
- collaboration
- large furniture/object libraries.

## Principles

1. **Walls are canonical; rooms are derived.** Never return to independent room rectangles.
2. **One geometry transaction architecture.** Dragging, typed dimensions, wall drawing, deletion, thickness edits, and snapping must all produce canonical candidate topology and pass the same validation/reconciliation/commit boundary.
3. **Human semantics after structural ambiguity.** Face splits/merges/new faces may require user resolution; never guess room identity from names or geometry.
4. **Direct manipulation first.** Drag or draw the physical thing; type exact values when precision matters.
5. **Architectural language only.** Do not expose graph/topology terminology in normal UX.
6. **Safe experimentation.** Preview is transient; invalid candidates never corrupt the committed project; Escape/pointer-cancel is exact.
7. **Derived facts stay derived.** Faces, clear geometry, exterior envelope, coverage, adjacency, and dimensions are recomputed from canonical source data.
8. **Option-3 is a fixture, not an assumption.** Generic features need non-Option-3 tests.

## Interaction state model

Every geometry-authoring action follows the same lifecycle:

`idle → hover → selected/tool-active → editing preview → valid / invalid / remapRequired → commit or cancel`

Commit creates one logical undo entry. Preview never writes persistence/history.

The conceptual pipeline is:

`user intent → topology operation → topology validation → derived faces → semantic reconciliation/resolution → exterior/coverage derivation → atomic project commit`

## B0 — Interaction transaction contract

Completed foundation.

Required invariant remains:

- immutable begin snapshot
- non-cumulative preview from that snapshot
- one commit per gesture
- exact cancel
- invalid/remap-required states are explicit
- future tools reuse the same transaction semantics.

## B1 — Canonical selection and hit testing

Completed foundation.

Selection is based on persistent semantic spaces, canonical walls, and canonical nodes with deterministic hit precedence and screen-space tolerance.

## B2 — Existing-wall and junction manipulation

Expose movement of existing topology through direct manipulation.

Required behavior:

- internal walls move perpendicular only
- exterior walls use the same movement path
- junctions preserve connectivity/orthogonality
- live valid/invalid preview
- footprint consequence from A4 geometry
- exact cancel
- one undo step per successful gesture.

B2 intentionally does not yet add/delete walls.

## A4-Coverage integration

After B2, replace legacy coverage authority with the canonical physical coverage engine.

The coverage algorithm must be generic even though the current ProjectV2 fixture supplies 66/100:

- gross area from physical exterior envelope
- explicit open-to-sky clear-interior exclusions
- exact rational policy comparison
- no room-sum/common-area authority
- live preview/commit/undo consistency.

## B3 — Direct architectural dimensions

Dimensions are both information and an editing surface.

Required behavior:

- contextual clear dimensions
- typed feet/inches input
- clear distinction between clear-space, centre-line, and exterior dimensions
- typed change reaches the same canonical transaction used by drag
- Enter commits; Escape cancels
- invalid values explain the reason in architectural language.

## G1 — Generic project/document foundation

Before wall creation/deletion is treated as product authoring, migrate away from Option-3-only document assumptions.

Introduce the next major project schema and explicit ProjectV2 migration.

Required product capabilities:

- New Project
- arbitrary project identity/name
- empty topology
- no mandatory Option-3 recovery/reference assets
- project-specific site metadata
- generic coverage-policy provenance
- generic storage/export naming
- save/load blank and user-authored projects.

Option-3 remains importable/recoverable as a historical fixture.

## B4 — Topology Authoring

This is mandatory for Phase B completion.

### Wall tool

Users can draw partitions/exterior walls with:

- point-to-point or drag interaction
- orthogonal constraint
- chosen/default thickness
- automatic endpoint reuse
- T/X intersection detection and splitting
- preview/cancel/one commit.

### Delete wall

Users can delete canonical segments/runs safely.

Deletion must:

- validate resulting graph
- remove redundant isolated nodes only when unambiguous
- preserve unrelated IDs where possible
- surface room merge/disappearance through semantic reconciliation.

### Thickness editing

Changing wall thickness is a canonical geometry edit that updates clear-space geometry, physical envelope, site validity, and coverage as appropriate.

### Structural semantic resolution

A dedicated workflow resolves:

- split spaces
- merged spaces
- orphaned previous spaces
- newly unclaimed faces
- ambiguous correspondence.

The UI should ask explicit questions such as which child keeps the old room identity and what new space to create. It must not silently choose.

### Space semantic editing

For new/existing semantic spaces support at least:

- name
- category
- architectural role
- enclosure/open-to-sky classification.

### Exterior authoring

Users can create/remove/reconnect walls that alter the building perimeter. There is no separate footprint shape; A4 derives it from topology.

### Blank-plan acceptance

From a fresh generic project the user can draw a building enclosure, create rooms by adding partitions, merge rooms by deleting partitions, reshape the exterior, and save/reload the result.

## B5 — Snapping, guides and precision controls

Snapping applies to movement and wall-authoring tools.

Priority generally:

1. existing junction/end point
2. wall extension/alignment
3. architectural alignment
4. grid/increment.

Required behavior:

- screen-space threshold
- visible target/guide
- hysteresis
- temporary disable modifier
- keyboard nudging where useful
- canonical validation always remains final authority.

## B6 — Inspector, semantic authoring, and understanding

The inspector answers:

- what is this?
- what can I change?
- what will that change affect?

### Space selected

Show/edit useful information such as:

- name/type/role/enclosure
- clear dimensions/area
- adjacency
- exterior/shared wall relationships.

### Wall selected

Show:

- internal/shared/exterior classification
- length/thickness
- adjacent spaces
- footprint/coverage consequence
- thickness/dimension controls where applicable.

### Node selected

Show connected-wall context and movement consequences in plain language.

### Semantic resolution

`remapRequired` must have a human-facing resolution experience rather than validator output.

## B7 — Editing shell and visual polish

Recommended permanent shell:

- New/Open/Save
- Undo/Redo
- Fit/zoom
- Select tool
- Wall tool
- Dimension/Measure tool
- main canvas
- contextual inspector
- compact layer/display controls.

Requirements:

- clear empty-project state
- quiet autosave state
- good keyboard/focus behavior
- no dependence on a reference image
- Option-3 restore clearly labeled as fixture/recovery, not generic reset
- exported SVG/JSON free of interaction overlays.

## Performance target

Correctness is more important than exotic optimization, but previews should feel immediate.

During preview:

- avoid persistence/history writes
- recompute only necessary derived state where practical
- do not bypass validation for speed.

After commit:

- canonical validation/reconciliation
- derived-space/exterior/coverage recomputation
- one history entry
- autosave.

## Accessibility and comprehension

Important actions must remain mouse-discoverable and keyboard-accessible.

- visible focus
- Escape consistently cancels/closes
- Enter applies editable fields
- selection/invalid state not expressed by color alone
- reasonable text/control sizes
- concise actionable errors.

## Acceptance scenarios

Phase B is not complete until both categories pass.

### Option-3 regression

1. Select spaces/walls/nodes reliably.
2. Drag shared walls and preserve footprint.
3. Drag exterior walls and update coverage.
4. Type exact dimensions through the same transaction path.
5. Cancel invalid edits safely.
6. Use snapping/guides.
7. Undo/redo and save/reload extensively.

### General-editor acceptance

Without calling Option-3 project/topology factories:

1. Create a new rectangular site/project.
2. Start from empty topology.
3. Draw an exterior rectangle.
4. Create/assign the first semantic space.
5. Add several partitions and resolve new spaces.
6. Move internal partitions.
7. Type exact dimensions.
8. Delete a partition and explicitly resolve the merge.
9. Reshape the exterior.
10. Change wall thickness.
11. Create a bounded open-to-sky courtyard and classify it explicitly.
12. Verify physical coverage.
13. Undo/redo structural edits.
14. Save, reload, export, and continue editing.

## Phase B exit criterion

Phase B is complete only when Plan 66 is pleasant to use **and** genuinely authorable: a user can create an arbitrary orthogonal floor plan from scratch, alter its topology and semantics safely, and persist it without dependence on Option-3 IDs, rooms, dimensions, reference assets, or legacy rectangles.
