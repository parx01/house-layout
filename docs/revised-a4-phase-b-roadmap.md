# Revised roadmap: minimal A4 before Phase B

The goal is no longer to complete all of A4 before Phase B.

Only implement the geometry knowledge that Phase B genuinely depends on first. Defer coverage-specific work until the interaction path that will consume it exists.

---

## A3.6 — Semantic integration and closure

Complete the existing A3.6 consolidation task first.

A3 must finish with:

- complete semantic ownership of bounded faces
- stable `SpaceId` behavior
- safe reconciliation/remapping
- explicit architectural role/enclosure
- architectural-understanding layer
- clear distinction between semantic-neighbor walls and true exterior walls
- migrations/round-trip/integration tests.

After this, close A3.

---

# A4-Core — Exterior geometry foundation

Do **only the A4 functionality required before interactive wall editing**.

Do not implement the complete coverage feature yet.

## A4-Core.1 — True exterior boundary classification

Derive from canonical topology which wall segments participate in the actual exterior building boundary.

This must not use:

- semantic `boundaryWallIds`
- room names
- legacy room rectangles
- manually tagged exterior walls.

Provide a pure derived representation of:

- exterior wall segments
- internal/shared wall segments
- exterior boundary loop(s)
- orientation/order around an exterior loop where useful.

It must remain correct after valid A2.5 topology movement.

## A4-Core.2 — Exterior wall-band geometry

Using canonical wall thicknesses, derive the physical outer building boundary/wall-band geometry needed to answer:

> Does moving this wall change the building footprint?

Do not use centre-line face area as the footprint.

Establish the distinction:

- internal wall movement → does not change exterior footprint
- exterior wall movement → may change exterior footprint.

A numerical final coverage percentage is **not required yet**.

## A4-Core.3 — Movement classification contract

Expose enough derived information for Phase B to classify a selected/moved wall as:

- internal/shared
- exterior/footprint-affecting
- structurally/topologically invalid.

A2.5 remains the geometry transaction engine.

Do not create a separate movement implementation.

Add invariants/tests proving:

- representative internal Option-3 wall moves preserve the exterior envelope
- representative exterior Option-3 wall moves alter it
- junction movements are classified consistently
- topology IDs and semantic identities remain valid where A2/A3 say they should.

## A4-Core.4 — API prepared for later coverage

Design the derived exterior-envelope result so the later A4-Coverage stage can calculate area and exclusions without replacing this implementation.

But stop before:

- 66% comparison
- final covered-area policy
- courtyard/open-to-sky subtraction policy
- UI coverage indicators
- retirement of old coverage display.

After A4-Core passes audit, start Phase B.

---

# B0 — Interaction transaction contract

Define the user-interaction contract around the already-established geometry operations.

Required concepts:

- preview during pointer movement
- commit on pointer-up
- Escape/pointer-cancel restores original state
- one undo operation per gesture
- invalid candidate never corrupts project
- typed dimensions later use the same canonical transaction path.

No major UI polish yet.

---

# B1 — Topology/space selection

Implement reliable selection for:

- semantic space
- canonical wall
- canonical junction/node.

Add:

- generous hit targets independent of visual stroke thickness
- clear hover/selected states
- inspector-ready selection model
- deterministic precedence when objects overlap.

No geometry editing yet beyond selection.

---

# B2 — Direct wall and junction editing

Now implement the first real interactive geometry editing.

Use A2.5 operations and the A4-Core exterior classification.

## Internal walls

Dragging an internal shared wall:

- moves perpendicular only
- redistributes adjacent spaces
- preserves topology
- preserves semantic identity
- must not alter exterior footprint.

## Exterior walls

Dragging an exterior wall:

- uses the same transaction architecture
- may alter exterior footprint
- is explicitly identified as footprint-affecting.

At this stage it is enough for the UI/model to know:

> This edit changes the building footprint.

It does not yet need the final 66% percentage.

## Junctions

Use canonical A2.5 junction movement and preserve connectivity.

Implement:

- live preview
- invalid-move feedback
- rollback
- single undo transaction
- movement metadata.

Once B2 is stable, stop and integrate the remainder of A4.

---

# A4-Coverage — complete coverage engine after B2

Now finish the deferred parts of A4, using the real B2 transaction path as an integration target.

## A4-C.1 — Authoritative footprint area

Calculate exact building footprint from the physical exterior envelope/wall faces.

Do not use:

- sum of semantic room areas
- centre-line face areas
- legacy room rectangles
- `commonAreaMm2`
- manually forced 1969.11 sqft.

## A4-C.2 — Open-to-sky exclusions

Support explicitly classified A3.5 spaces such as:

- `courtyardVoid`
- `openToSky`.

Define and test how bounded open-to-sky voids affect the covered footprint.

Current Option-3 has no such bounded courtyard; retain a synthetic fixture so the capability remains tested.

Do not infer an open courtyard from its name.

## A4-C.3 — Coverage rule

Calculate:

`authoritative covered footprint / exact property area`

against the existing project rule:

`66 / 100`

Keep its status:

`userSuppliedUnverified`

Do not present it as a verified Haryana regulatory requirement.

Expose:

- plot area
- covered footprint
- coverage percentage
- allowed percentage
- remaining/excess area
- compliant/exceeded state under the user-supplied rule.

## A4-C.4 — Editing invariants

Integrate directly with B2 transactions.

Prove:

- internal-wall drag → coverage exactly unchanged
- exterior-wall drag → coverage updates correctly
- rejected edit → coverage/project unchanged
- undo restores exact previous coverage
- semantic rebinding does not alter coverage by itself.

This is why coverage is being finished after B2 rather than before it.

## A4-C.5 — retire legacy coverage

Remove the legacy `rooms + commonAreaMm2` calculation from any authoritative UI/path.

Remove the hard-coded/manual 1969.11 sqft authority.

Legacy data may remain only for recovery/reference where necessary.

Coverage displayed to the user must now come from canonical topology/exterior geometry.

Audit A4-Coverage before continuing.

---

# B3 — Direct typed architectural dimensions

Implement typed dimensions **after the B2 + A4 transaction path is complete**.

This is deliberate.

A typed change and drag must call the same canonical geometry transaction.

Therefore:

- typed internal-wall dimension → no coverage change
- typed exterior dimension → coverage updates through A4 automatically
- same validation
- same undo semantics
- same topology/semantic reconciliation.

Support ft/in parsing through the existing exact-unit system.

Clearly distinguish:

- clear room dimension
- centre-line geometry
- exterior/overall dimension.

Do not create parallel geometry code for typed editing.

---

# B4 — Snapping and alignment guides

Add interaction assistance on top of the stable transaction path:

- useful architectural snapping
- node/wall alignment
- equal/aligned guides where justified
- existing project snap increment
- visual guides
- temporary modifier behavior if useful.

Snapping must propose geometry; canonical validation remains authoritative.

---

# B5 — Inspector and architectural understanding

Now expose A3.4 + A3.5 + A4 information coherently.

For selected spaces/walls show useful information such as:

- semantic name/type
- clear dimensions
- clear area
- adjacency
- wall thickness
- internal vs exterior wall
- whether moving the selected wall affects footprint
- current authoritative coverage where relevant.

Avoid exposing implementation concepts unnecessarily.

---

# B6 — Editor shell and polish

Polish the interaction experience:

- hierarchy
- toolbar
- inspector
- zoom/pan
- selection appearance
- dimension presentation
- empty/error states
- autosave status
- undo/redo affordances
- keyboard interactions.

Aim for a lightweight Figma/Rayon-style architectural planner, not CAD/BIM complexity.

---

# B7 — Real-use QA

Exercise the editor as a house-planning tool rather than only with unit tests.

Test:

- repeated wall moves
- internal/exterior transitions
- typed edits after dragging
- undo/redo sequences
- invalid moves
- semantic stability
- save/reload
- coverage changes
- zoom levels
- actual Option-3 redesign workflows.

Fix interaction or geometry integration defects before considering Phase B complete.

---

# Final dependency chain

The new order is:

**A3.6**

→ **A4-Core**
- exterior classification
- physical envelope
- footprint-affecting movement knowledge

→ **B0**
- transaction contract

→ **B1**
- selection

→ **B2**
- wall/junction dragging

→ **A4-Coverage**
- exact footprint area
- open-to-sky exclusions
- 66% calculation
- live B2 integration
- remove legacy coverage authority

→ **B3**
- typed dimensions through the same transaction path

→ **B4**
- snapping/guides

→ **B5**
- architectural inspector

→ **B6**
- polish

→ **B7**
- real-use QA

## Key architectural rule

Do not hold Phase B hostage to coverage calculations it does not yet need.

But also do not implement interactive exterior-wall editing without first establishing a canonical definition of the exterior building boundary.

This keeps the geometry foundation ahead of the UI by exactly the amount required, while letting later A4 coverage functionality be integrated against a real interaction path instead of being built speculatively.
