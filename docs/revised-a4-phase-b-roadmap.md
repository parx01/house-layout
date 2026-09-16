# Revised roadmap: general floor-plan editor

## Hard product requirement

Plan 66 must become a genuine **general-purpose orthogonal floor-plan editor**.

Option-3 is the current curated project, migration source, visual reference, and regression fixture. It is **not** the product's permanent geometry template.

Every future stage must be judged by this rule:

> If an implementation only works because the Option-3 wall graph, IDs, rooms, dimensions, reference image, or legacy rectangles already exist, it is not generally complete.

See `docs/general-floor-plan-editor-architecture.md` for the accepted architectural decision and audit findings.

The initial general editor may remain intentionally constrained to 2D, one floor, rectangular sites, and orthogonal walls. Those are product-scope constraints, not Option-3 dependencies.

---

# Completed foundation

The following stages establish reusable geometry and are intentionally retained:

- **A3.6** — semantic closure, persistent `SpaceId`, explicit role/enclosure, safe reconciliation.
- **A4-Core** — true exterior classification, physical exterior wall-face envelope, footprint-impact transaction contract.
- **B0** — preview/commit/cancel interaction lifecycle with one undoable commit per gesture.
- **B1** — canonical space/wall/node selection and screen-stable hit testing.

These layers are topology-driven and remain valid for arbitrary orthogonal plans.

---

# B2 — Direct wall and junction editing

Use the existing A2.5 movement engine through B0.

Required behavior:

- internal/shared wall drag perpendicular to its axis
- exterior wall drag through the same transaction architecture
- junction movement while preserving canonical connectivity
- live candidate preview
- invalid/remap-required feedback
- Escape/pointer-cancel exact rollback
- one undo entry per successful gesture
- A4 footprint-impact metadata.

B2 is movement of existing topology only. It is not yet general topology creation/deletion.

---

# A4-Coverage — authoritative runtime coverage

Complete deferred A4 coverage after B2 so it can be exercised through the real edit path.

## A4-C.1 — Physical footprint area

Calculate exact gross footprint from A4-Core.2 physical exterior-envelope geometry.

Never use room sums, centre-line face area, legacy rectangles, `commonAreaMm2`, or the historical 1969.11 sq ft value as authority.

## A4-C.2 — Explicit open-to-sky exclusions

Subtract only the clear physical interior of semantic spaces explicitly marked `enclosure: "openToSky"`.

Do not infer courtyard/open-to-sky behavior from names.

Surrounding courtyard walls remain part of the physical footprint.

## A4-C.3 — Generic coverage-policy engine

The algorithm must consume a rational policy supplied by the project; it must not contain `66%` as a hard-coded algorithmic constant.

ProjectV2 currently supplies:

`66 / 100`, `userSuppliedUnverified`

That remains the Option-3 regression policy only. The later generic project schema will allow project-specific policy.

Use exact rational comparison rather than rounded percentages.

## A4-C.4 — Edit invariants

Prove through B2:

- internal wall movement leaves coverage exactly unchanged
- exterior movement updates coverage from geometry
- rejected/cancelled edits leave it unchanged
- undo/redo restores exact values
- semantic rebinding alone cannot change physical coverage.

## A4-C.5 — Retire legacy coverage authority

Legacy room/common-area data may remain for recovery/reference only.

All normal UI, summaries, exports, and later authoring workflows must consume A4 coverage.

Audit before B3.

---

# B3 — Typed architectural dimensions

Typed dimensions and drag must reach the **same canonical transaction path**.

Required distinctions:

- clear room dimension
- wall centre-line dimension
- exterior/overall dimension.

Typed changes must receive the same validation, semantic reconciliation, A4 coverage behavior, commit/cancel semantics, and undo treatment as drag.

Do not create a separate resize engine.

---

# G1 — Project generalization / ProjectV3 foundation

This stage is now mandatory before general topology authoring.

Current ProjectV2 remains an Option-3 historical schema: it hard-codes the Option-3 project identity/recovery contract and current site policy shape. Do not mutate its frozen meaning to pretend it was generic.

Introduce the next major document schema with explicit ProjectV2 migration.

The generic project model must support at minimum:

- arbitrary persistent project ID and name
- project creation without Option-3 fixtures/assets
- optional reference/recovery metadata
- rectangular project-specific site dimensions initially
- empty or active canonical topology
- semantic model that can begin empty/deferred and become user-authored
- project-specific front/road/orientation metadata
- generic rational coverage policy/provenance, including a not-configured state if appropriate
- existing versioned openings/dimensions/site-object boundaries
- strict validation and explicit migrations.

Also generalize persistence/UI assumptions:

- storage must not be permanently keyed to Option-3
- New Project becomes possible
- reset/restore distinguishes blank/new project from restoring the Option-3 fixture
- export filenames derive from project identity/name
- core save/load works without legacy rectangles or a reference image.

Acceptance gate:

A valid blank generic project can be created, saved, loaded, and rendered without calling an Option-3 factory.

---

# B4 — Topology Authoring

B4 is now a mandatory major stage, not snapping.

It turns the editor from an existing-layout modifier into a genuine floor-plan editor.

## B4.1 — Draw wall / partition

Implement a canonical wall tool using generic topology operations:

- point-to-point or drag
- horizontal/vertical constraint
- default/chosen thickness
- endpoint reuse
- automatic T/X intersection splitting
- topology preview/validation
- one atomic commit/cancel/undo.

Do not directly draw independent SVG geometry.

## B4.2 — Delete wall / partition

Add an explicit canonical deletion operation.

Requirements:

- delete one segment or a deliberately selected run
- remove redundant isolated nodes only when safe
- preserve unrelated topology IDs where possible
- validate final graph
- expose face disappearance/merge through semantic reconciliation
- never silently repair invalid topology by guessing.

## B4.3 — Wall thickness editing

Support changing canonical wall thickness through the same project transaction architecture.

Recompute:

- clear room geometry
- physical exterior envelope
- A4 coverage when exterior thickness affects footprint
- site containment/warnings.

## B4.4 — Structural semantic resolution

Topology changes may legitimately produce `remapRequired`.

Build the user resolution workflow for:

- face split
- face merge
- orphaned old space
- newly unclaimed face
- ambiguous correspondence.

For a split, the user chooses which child face keeps the existing `SpaceId`; additional faces receive new deterministic persistent IDs and explicit semantic metadata.

For a merge, the user chooses which identity survives or intentionally creates a replacement merged-space identity.

Never guess based on room name, relative area, or Option-3 knowledge.

## B4.5 — Space creation and semantic editing

For newly created faces support:

- name
- category
- architectural role
- enclosure (`enclosedCovered` / `openToSky`).

A room/space is a semantic identity bound to derived wall topology, never an independent rectangle.

## B4.6 — Exterior construction and reshape

Allow wall insertion/deletion/reconnection to create or reshape the building perimeter.

The existing exterior-envelope and A4 coverage engines must automatically describe the resulting building.

Do not add a separate "exterior shape" representation.

## B4.7 — Blank-plan workflow

A user must be able to:

1. create a generic project/site
2. begin from empty topology
3. draw an exterior enclosure
4. create and classify the first space
5. add partitions to create more spaces
6. resolve splits/new faces
7. delete a partition and resolve the merge
8. reshape the exterior
9. save/reload and continue.

This workflow must not depend on Option-3 factories or IDs.

Audit B4 before interaction polish continues.

---

# B5 — Snapping, alignment, and precision authoring

Apply snapping to both movement and topology-authoring tools.

Priority should generally be:

1. existing endpoint/junction
2. wall extension/alignment
3. meaningful architectural alignment
4. grid/increment.

Add screen-space thresholds, hysteresis, guides, modifier override, and keyboard nudging where useful.

Snapping proposes a candidate; canonical validation remains authority.

---

# B6 — Inspector and semantic authoring

Expose architectural understanding in plain language and provide contextual editing controls.

For spaces:

- name/type/role/enclosure
- clear dimensions and area
- adjacency
- relevant wall relationships.

For walls:

- internal/shared/exterior
- length/thickness
- adjacent spaces
- footprint/coverage consequence
- authoring controls where appropriate.

For structural `remapRequired` states, provide a dedicated resolution experience instead of raw validator terminology.

---

# B7 — Editor shell and polish

Polish the general editor rather than an Option-3-specific screen:

- New/Open/Save project behavior
- Undo/Redo
- Select / Wall / Dimension tools
- contextual inspector
- zoom/pan
- selection and authoring previews
- layers/reference controls
- autosave state
- accessible keyboard/mouse behavior
- clear empty-project state.

Option-3 restore/reference actions must be clearly fixture-specific, not the editor's definition of reset.

---

# B8 — General-editor real-use QA

Phase B is not complete with Option-3-only QA.

Keep Option-3 as a detailed regression, but add a zero-Option-3 acceptance workflow:

1. create a new site/project
2. start with empty topology
3. draw an exterior rectangle
4. assign the first space
5. add multiple partitions
6. resolve semantic splits/new faces
7. drag internal walls
8. type exact dimensions
9. move/reshape an exterior wall
10. delete a partition and resolve a merge
11. create/classify an open-to-sky courtyard
12. change wall thickness
13. verify coverage
14. exercise snapping
15. undo/redo structural operations
16. save/reload/export and continue editing.

This test must not call Option-3 project/topology/semantic factories.

---

# Dependency chain

**B2** — existing-wall/junction movement

→ **A4-Coverage** — generic physical coverage mechanics, current 66/100 as fixture policy

→ **B3** — typed dimensions

→ **G1** — generic ProjectV3/new-project foundation

→ **B4** — topology and semantic authoring

→ **B5** — snapping/guides

→ **B6** — inspector/semantic editing

→ **B7** — general editor polish

→ **B8** — Option-3 regression + blank-project real-use QA

## Architectural rule

Finish reusable geometry mechanics before broad authoring UI, but do **not** build general wall/room creation on the permanent assumption that the document is Option-3.

The product is complete only when arbitrary user-authored orthogonal plans can be created, structurally edited, semantically resolved, persisted, reloaded, and covered by the same canonical geometry engine.
