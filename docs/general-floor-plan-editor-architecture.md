# Architectural decision: Plan 66 must become a genuine floor-plan editor

Status: **Accepted / hard product requirement**

This decision is architectural, not aspirational:

> The final product must be a general-purpose **orthogonal 2D floor-plan editor**. Option-3 is only the first curated project, migration source, visual reference, and regression fixture. No permanent geometry, semantic, interaction, persistence, or coverage behavior may depend on the Option-3 wall graph, room arrangement, names, dimensions, or legacy rectangles.

A feature is not considered generally complete merely because it works on Option-3.

## Supported product boundary

The first general editor may deliberately remain narrower than CAD/BIM:

- desktop-first 2D editing
- horizontal/vertical walls only
- exact wall thickness
- canonical connected wall topology
- derived bounded spaces
- rectangular property/site boundary initially
- one floor initially
- no BIM, structural engineering, MEP, 3D, or collaboration requirement.

Those are explicit product-scope constraints. They are different from being tied to one house layout.

## Core geometry model remains the right foundation

The current low-level architecture already points in the correct direction:

- `TopologyV2` is an independent node/wall graph and can be empty or active.
- wall insertion/splitting operates on arbitrary valid orthogonal topology.
- bounded faces are derived from topology rather than stored as room rectangles.
- persistent `SpaceId` identity is separate from derived `FaceId` geometry.
- semantic reconciliation already detects face split, merge, orphaning, ambiguous correspondence, and newly unclaimed faces.
- exterior classification and physical exterior-envelope derivation are topology-driven.
- movement, selection, interaction preview/commit, and footprint-impact contracts use canonical IDs rather than Option-3 rectangles.

These layers should be extended, not replaced.

## Current Option-3 coupling is transitional

The audit found several deliberate historical constraints that must not become the final document architecture.

### ProjectV2 identity and recovery

Current `ProjectV2` hard-codes:

- `projectId: "option-3"`
- fixed Option-3 recovery fixture
- fixed Option-3 reference image identity.

That is appropriate for the current migration/reference project but not for arbitrary new plans.

### Site policy

Current `SiteV2` hard-codes the current project's `66 / 100` user-supplied coverage rule and Option-3 road provenance shape. The A4 coverage engine must therefore be written against a generic rational policy input even while ProjectV2 still supplies 66/100.

A later general project schema must allow a project-specific optional/configurable coverage rule and project-specific site/reference metadata without weakening provenance.

### Persistence and browser defaults

Current storage keys, load fallback, reset action, export filenames, recovery path, and default project creation are Option-3-specific. They are migration/UI defaults, not acceptable permanent document assumptions.

### Missing authoring operations

The current topology layer has robust wall insertion/splitting and movement, but a genuine editor still requires deliberate primitives/workflows for:

- deleting a wall or wall run
- cleanup of nodes made redundant by deletion
- changing wall thickness safely
- creating a new project from empty topology
- resolving semantic splits/merges/new faces after structural edits
- creating/editing semantic space metadata after new faces appear
- drawing or reshaping exterior topology through the same canonical transaction system.

## Persistence decision: general authoring requires a generic project schema

Do not mutate the meaning of frozen ProjectV2 fields to pretend they were generic.

The existing `docs/project-v2.md` policy already states that incompatible semantics require a new schema version. General project identity, optional recovery/reference assets, and project-specific site policy cross that boundary.

Therefore:

> **Before general topology-authoring UI is considered complete, introduce a generic ProjectV3 (or equivalent next major document schema) with an explicit ProjectV2 → ProjectV3 migration.**

ProjectV2 remains a supported historical Option-3 document and migration source.

ProjectV3 must at minimum support:

- arbitrary persistent project ID
- arbitrary project name
- new project creation without Option-3 assets
- optional/reference-source metadata rather than mandatory Option-3 recovery fields
- canonical topology starting empty or active
- semantic spaces starting empty/deferred and becoming user-authored
- project-specific site dimensions and front/orientation metadata
- generic rational coverage policy with provenance, including an explicit unavailable/not-configured state if appropriate
- stable versioned topology/space/opening/dimension/site-object slots
- strict migrations and validation.

Do not implement ProjectV3 prematurely inside B2 or A4-Coverage. First finish the reusable movement, coverage, and dimension mechanics. But do not build general wall/room authoring on top of an Option-3-only persistence contract.

## General-editor transaction rule

Every geometry mutation must pass through the canonical transaction architecture.

There must not be separate geometry engines for:

- dragging
- typed dimensions
- wall drawing
- deletion
- snapping
- inspector edits.

The intended flow is:

`user intent → canonical topology operation → topology validation → derived faces → semantic reconciliation/resolution → exterior/coverage derivation → one atomic project commit`

Preview uses the same candidate path without mutating the committed project.

## Rooms/spaces are consequences of walls

The editor must not return to independent room rectangles.

A user edits physical topology. Bounded faces are derived from that topology. Semantic identity is then reconciled or explicitly assigned.

Examples:

### Split a room

Drawing a partition through one existing space may create two bounded faces.

Geometry may succeed immediately, but semantics must not guess.

The reconciliation layer should report the split. The UI then asks the user which resulting face retains the original `SpaceId` and what semantic identity the new face should receive.

### Merge rooms

Deleting a separating wall may merge two semantic spaces into one face.

The UI must require an explicit merge resolution: choose which identity survives or create a replacement merged-space identity. Do not silently choose by name or area.

### New enclosed space

Drawing walls that create a previously nonexistent bounded face yields an unclaimed face. The user assigns a new `SpaceId`, name, role/category, and enclosure classification as appropriate.

### Open-to-sky space

An open courtyard is created by geometry like any other bounded face, then explicitly classified with `enclosure: "openToSky"`. A4 coverage reacts to that semantic property. It must never infer courtyard/open-sky status from names.

## Required topology-authoring capabilities

A dedicated **Topology Authoring** stage is mandatory and must include at least:

1. **Draw wall/partition**
   - point-to-point or drag interaction
   - orthogonal constraint
   - automatic endpoint reuse
   - automatic T/X intersection splitting
   - chosen/default wall thickness
   - preview, validation, cancel, one commit.

2. **Delete wall/partition**
   - delete a canonical segment or deliberately selected run
   - remove redundant isolated nodes where safe
   - validate resulting topology
   - expose face merge/disappearance through semantic reconciliation.

3. **Wall thickness editing**
   - use canonical wall thickness
   - validate resulting wall-band/site constraints
   - update clear geometry and exterior envelope/coverage where applicable.

4. **Exterior construction/reshape**
   - create, remove, and reconnect exterior wall runs
   - allow the footprint to expand/contract within the site
   - use the same canonical exterior/coverage derivations.

5. **Semantic split/merge/new-face resolution UI**
   - explicit human resolution for `remapRequired`
   - deterministic creation of new `SpaceId`s
   - no name/geometry guessing.

6. **Space metadata editing**
   - name
   - category
   - architectural role
   - enclosure/open-to-sky classification.

7. **Blank/new-plan workflow**
   - create project/site
   - begin from empty topology
   - draw an exterior enclosure
   - add/remove partitions
   - assign spaces
   - save/reload and continue editing.

## Roadmap dependency change

The future sequence is now:

**B2 — direct movement**

→ **A4-Coverage — generic runtime coverage engine using the current project's rule**

→ **B3 — typed dimensions through the same transaction path**

→ **G1 — Project generalization / ProjectV3 foundation**

→ **B4 — Topology Authoring**

→ **B5 — Snapping, guides, and precision authoring**

→ **B6 — Inspector and semantic authoring**

→ **B7 — Editor shell/polish**

→ **B8 — General-editor real-use QA**

This ordering intentionally allows the already-built reusable geometry foundation to finish before the document migration, while preventing general authoring from being built around Option-3-only persistence.

## A4-Coverage implication

A4-Coverage must not encode `66%` as an algorithmic constant.

It should consume a rational coverage policy supplied by the project and compare exactly. ProjectV2 currently supplies `66/100 userSuppliedUnverified`; ProjectV3 later supplies a generic project-specific policy.

Option-3's current value remains a golden regression, not a universal rule.

## Test strategy changes

Option-3 remains valuable as a detailed regression fixture, but every general capability must also have synthetic/non-Option-3 tests.

From the ProjectV3/Topology Authoring stage onward, a major acceptance test must start without Option-3:

1. create a new rectangular site
2. start from empty topology
3. draw a rectangular exterior building
4. assign the first semantic space
5. add internal partitions to create multiple spaces
6. resolve semantic splits/new faces
7. move an internal partition
8. move/reshape an exterior wall
9. delete a partition and resolve the merge
10. create and classify an open-to-sky courtyard/void
11. change a wall thickness
12. use typed dimensions
13. verify coverage changes only when appropriate
14. undo/redo structural edits
15. save, reload, and continue editing
16. export without requiring any Option-3 fixture/reference data.

The test must not call Option-3 factory functions or depend on Option-3 IDs.

## Definition of product completion

The product is not a genuine floor-plan editor until all of the following are true:

- Option-3 can be extensively redesigned.
- a non-Option-3 project can be created from scratch.
- walls can be created, moved, resized, thickened, and deleted.
- spaces naturally split/merge as wall topology changes.
- semantic identities are explicitly resolved after structural changes.
- exterior footprint and coverage derive from whatever geometry exists.
- save/reload preserves arbitrary user-authored plans.
- core editing does not require Option-3 IDs, names, dimensions, reference image, recovery fixture, or legacy rectangles.

Until then, Option-3 is the development fixture for a general editor under construction, not the product boundary.
