# Phase B — Polished Interaction & Understanding Plan

## Product target

Phase B turns the trustworthy geometry built in A2–A4 into the actual product experience.

The target is **Figma-like ease for house planning**, not CAD complexity: direct manipulation, clear architectural dimensions, minimal controls, strong visual feedback, and enough explanation that a non-CAD user can understand what each edit changes.

Phase B is considered successful when the user can comfortably redesign the house for long sessions without needing to understand topology, wall graphs, micrometres, or internal geometry rules.

## Principles

1. **One obvious action at a time.** Selection determines the controls shown. Avoid permanent panels full of irrelevant fields.
2. **Direct manipulation first.** Drag the thing that should move; type a value when exactness matters.
3. **Architectural language only.** Use `10' 6"`, `Clear width`, `Wall thickness`, `Rear setback`, `Room area`, etc. Never expose topology jargon.
4. **Immediate cause-and-effect feedback.** While moving a shared wall, show which spaces grow/shrink and which dimensions change.
5. **Safe experimentation.** Invalid edits preview clearly and cannot corrupt the plan. Undo, Escape/cancel, and restore are dependable.
6. **Low visual noise.** Dimensions, guides and warnings appear when useful and fade when not relevant.
7. **Understanding is a feature.** The editor should explain a selected room/wall in plain language, not merely expose geometry.
8. **Desktop-first.** Optimize for mouse/trackpad + keyboard and normal laptop/desktop screens. No mobile editing requirement in Phase B.

## Phase B scope

### B1 — Topology-native rendering and selection

Replace the legacy rectangle representation in the working editor with the canonical topology/space model.

Required behavior:

- Render canonical walls once, with wall thickness visually represented.
- Render derived spaces beneath walls.
- Clear hover and selected states for spaces, walls and junctions.
- Selection precedence must be predictable when objects overlap.
- Clicking empty canvas clears selection.
- Reference image, property boundary, setbacks and grid remain independent layers.
- Provide a `Fit plan` action and reliable pan/zoom.
- Maintain good hit targets even for thin walls and high zoom.

The visual hierarchy should make the plan itself dominant. Property/setback/reference information must remain secondary.

### B2 — Shared-wall and junction editing

Expose A2 geometry transactions through direct manipulation.

Required behavior:

- Drag internal shared walls perpendicular to their axis.
- Drag eligible junctions/corners while preserving connectivity and orthogonality.
- Exterior wall movement is clearly distinguishable from internal-wall movement.
- Movement previews must be transient; commit once on pointer-up.
- Escape/pointer-cancel restores the exact pre-edit state.
- Invalid/self-intersecting/inverting moves are visibly rejected before commit.
- Prevent rooms from collapsing below the defined minimum clear dimension.
- Undo/redo records one logical edit per gesture, not every pointer movement.

During a shared-wall drag, show live before/after effects on adjacent spaces, for example:

`Kitchen 10' 0" → 10' 6"`  
`Lobby 14' 2" → 13' 8"`

Internal-wall movement must not imply a coverage change. Exterior-wall movement may.

### B3 — Direct architectural dimensions

Dimensions are a primary editing interface, not decoration.

Required behavior:

- Show useful clear dimensions for the current selection.
- Click a dimension value to edit it directly.
- Accept the existing architectural input grammar such as `10'`, `10'6"`, `9' 3"`, and decimal-foot compatibility.
- Typed dimensions invoke the same validated geometry transaction as dragging.
- Clearly distinguish **clear room dimension** from wall centre-line or exterior measurement when relevant.
- Enter commits; Escape cancels.
- Invalid values explain why they cannot be applied in plain language.
- Avoid flooding every wall with dimensions simultaneously.

Default dimension visibility should be contextual: selected space/wall first, surrounding critical dimensions second.

### B4 — Snapping, guides and precision controls

Snapping should help without feeling magnetic or mysterious.

Priority should generally be:

1. existing junction/end point
2. wall extension/alignment
3. meaningful architectural alignment
4. grid/increment snap

Required behavior:

- Temporary alignment guides during drag.
- Clear snap indicator showing what is being aligned to.
- Screen-space snap threshold so behavior feels consistent at different zoom levels.
- Hysteresis so a selected snap target does not flicker between candidates.
- `Alt` temporarily disables snapping during a drag.
- Arrow-key nudging for selected movable geometry.
- Shift/modifier behavior may provide larger/finer nudges if useful, but keep shortcuts minimal.

Never commit a snap candidate that produces invalid topology.

### B5 — Inspector, language and understanding mode

The inspector should answer **“what is this?”**, **“what can I change?”**, and **“what happens if I change it?”**.

#### Space selected

Show only useful information such as:

- name
- clear dimensions
- clear floor area
- relevant adjacent spaces
- exterior/shared wall relationships
- current setback relationship when applicable

Example explanation:

> Kitchen — 10' × 9' 3", 92.5 sq ft. The right wall is shared with the Lobby. Moving it changes both spaces but does not change the building footprint.

#### Wall selected

Show:

- wall type in plain language: internal/shared or exterior, derived from geometry
- length
- thickness
- adjacent spaces
- whether moving it affects building footprint/coverage
- editable movement/dimension controls

#### Junction selected

Show a compact description of connected walls and the effect of moving the junction.

#### Warnings

Warnings should be concise and actionable, for example:

- `Rear setback is 7' 6". Your design target is 8'.`
- `This move would make the Kitchen only 2' 4" wide.`
- `This wall cannot move farther because it would cross another wall.`

Do not expose validator or exception wording directly to the user.

### B6 — Editing shell and visual polish

Keep the permanent interface intentionally small.

Recommended shell:

- compact top bar: Undo, Redo, Fit, zoom state, save state
- small primary tool group: Select, Wall, Measure/Dimension, Pan only if Pan needs an explicit tool
- main plan canvas
- contextual inspector on the right
- optional layer/display popover instead of a large permanent panel

Display toggles should include only genuinely useful layers:

- room names
- dimensions
- setbacks
- reference image
- grid
- guides/annotations as appropriate

Other requirements:

- strong typography hierarchy and readable text at normal laptop resolution
- no tiny CAD-style icons without labels/tooltips
- generous hit targets
- keyboard shortcut shown in tooltip/menu where one exists
- smooth pan/zoom and no unexpected page scrolling while manipulating the canvas
- selection must remain visually obvious at all zoom levels
- autosave state shown quietly: `Saving…`, `Saved`, or an actionable error
- restore baseline Option-3 through an explicit protected action
- optional wall/geometry lock only if it solves a real accidental-edit problem; do not add a complex permissions system

## Interaction states

Every geometry edit should follow the same interaction state model:

`idle → hover → selected → editing preview → valid/invalid preview → commit or cancel`

The UI must never render an invalid candidate as though it were committed.

Use the geometry core as authority. The renderer/inspector may request changes but must not independently mutate room dimensions, wall coordinates or areas.

## Performance and fluidity target

The plan is small, so correctness and interaction quality matter more than exotic optimization.

During drag:

- update only preview-dependent rendering where practical
- avoid persistence/history writes until commit
- keep pointer response perceptually immediate
- do not run expensive work unrelated to the current preview

After commit:

- validate once through the canonical transaction path
- recompute derived spaces/dimensions/warnings
- create one history snapshot
- autosave

## Accessibility and comprehension

Phase B should remain usable without memorizing shortcuts.

- all important actions available by mouse
- visible focus state for keyboard interaction
- Escape consistently means cancel/close
- Enter consistently means apply where a field is being edited
- text and controls meet reasonable contrast/size expectations
- color is not the only indication of invalid/selected/warning states

## Explicitly out of Phase B

Do not expand Phase B into a full architectural suite.

Deferred unless later requested:

- door/window authoring
- furniture library
- electrical/plumbing/MEP
- structural design
- BIM concepts
- 3D
- multi-floor workflows
- collaboration
- large productivity toolsets such as multi-select distribution, variants, bulk duplication, advanced import, etc.

Parking, doors/windows and richer architectural objects may be added later only when they become useful to the actual house-design workflow.

## Suggested implementation sequence

### B0 — Interaction design contract
Freeze selection behavior, visual states, inspector language, shortcuts and edit-state semantics before broad UI implementation.

### B1 — Read-only topology/space renderer
Render the authoritative geometry and verify visual parity with the accepted Option-3 baseline.

### B2 — Wall/junction manipulation
Connect direct manipulation to canonical geometry transactions with preview/cancel/undo.

### B3 — Direct dimensions
Add contextual dimensions and type-to-resize through the same transaction path.

### B4 — Snapping and precision
Add ranked snapping, guides, override and keyboard nudging.

### B5 — Understanding inspector
Add plain-language space/wall explanations, live effects and warnings.

### B6 — Polish and usability pass
Refine layout, typography, interaction latency, tooltips, layer controls, autosave feedback and keyboard/mouse consistency.

### B7 — Real-use QA
Use the editor to perform representative house redesign work for an extended session and fix friction before considering Phase B complete.

## Acceptance scenarios

Phase B is not complete until these feel natural:

1. Select the Kitchen and immediately understand its dimensions, area and adjacent walls.
2. Drag a Kitchen/Lobby shared wall; both dimensions update live and the total footprint remains unchanged.
3. Click a clear dimension, type a new feet/inches value, and get exactly the same result as a drag.
4. Attempt an invalid move; the UI explains the problem and the committed plan remains untouched.
5. Move an exterior wall and clearly see the footprint/coverage implication.
6. Align a wall with another wall using an obvious temporary guide; temporarily disable snapping when desired.
7. Make several edits, Undo/Redo them reliably, cancel a drag with Escape, and never lose geometry integrity.
8. Hide the reference/grid/dimensions and still understand the floor plan immediately.
9. Work comfortably at normal laptop resolution without side panels overwhelming the drawing area.
10. A user unfamiliar with CAD can discover the primary editing workflow without documentation.

## Phase B exit criterion

Phase B is complete when the canonical Plan 66 model is not merely editable but **pleasant to use as the user's main house-planning workspace**: precise when needed, forgiving while exploring, visually quiet, understandable in plain language, and difficult to corrupt accidentally.
