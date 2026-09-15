# Plan 66 house-plan editor

Plan 66 is a local SVG editor for inspecting and adjusting the OPTION-3 rectangle prototype. Its ProjectV2 foundation now includes the curated A2.3 canonical physical wall topology while the visible editor remains the isolated legacy adapter.

## Open it

Serve the `dist` folder from a local web server, then open the printed local URL in Chrome. For example:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8765/`. Keep the entire `dist` folder together because the editor loads its compiled foundation, stylesheet, and preserved reference image from nearby files.

## Edit the legacy prototype

- Move a room: choose **Select**, then drag the room.
- Resize a room: select it, then drag an edge or corner handle.
- Remove one side of a room: click that wall, then choose **Delete selected**.
- Add a room or wall with the drawing tools.
- Enter room and site lengths as architectural measurements such as `10'6"` or `49'2"`.
- Undo or redo with the buttons or keyboard shortcuts.

The browser saves a strictly validated ProjectV2 document locally. **Save project** downloads the same V2 format. A corrupt project or an unsupported schema version is rejected explicitly; it is never shallow-merged into defaults. A1-era ProjectV2 saves are recovered by an explicit schema-revision migration before validation.

## Exact site and supplied coverage limit

- Frontage: **49'2"**
- Depth: **79'2"**
- Plot area: **3,892.3611 sq ft**
- Supplied 66% maximum: **2,568.9583 sq ft**

The 66% figure is recorded as user-supplied and unverified. The editable 4-ft side, 8-ft minimum rear, and 10-ft preferred rear values are design targets, not statutory setbacks. The front target remains flexible and north remains unknown until authoritative information is available.

The drawing itself labels the front road as 12.00 m wide, so ProjectV2 retains 12,000,000 µm with `referencePlanSuppliedUnverified` provenance. This is plan metadata, not independent confirmation. The tracing image remains calibrated to the original Option-3 property when experimental site dimensions are edited; the site boundary, grid, target envelope, and drawing frame follow the edited dimensions.

The visible **1,969.11 sq ft** covered-area number is explicitly a legacy rectangle-prototype estimate. ProjectV2 does not treat it as an authoritative building footprint. Exterior-envelope coverage is deferred to A4.

## A0/A1 engineering structure

- `src/core`: branded integer unit helpers, geometry primitives, site calculations, design envelopes, and warning categories.
- `src/project`: ProjectV2 types, strict validation, and the Option-3 baseline.
- `src/topology`: canonical node/wall graph, structural validation, and A2.2 atomic intersection/splitting operations.
- `src/spaces`: A2.4 renderer-independent, derived bounded-face extraction from canonical topology.
- `src/persistence`: schema detection, V1 recovery wrapping, ProjectV2 serialization, and browser storage.
- `src/ui`: the adapter that keeps the existing rectangle editor inspectable.
- `fixtures`: immutable original V1 state and reference-image identity.
- `docs`: ProjectV2 boundary and coordinate/orientation convention.
- `test`: Vitest coverage for units, site calculations, validation, recovery, and preserved assets.

Install dependencies once, then run:

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` compiles the TypeScript foundation to `dist/foundation`. The existing SVG renderer remains a transitional legacy UI adapter; A2.3 does not add production topology rendering or editing.

A2.1 establishes only the internal serialized topology graph. The current Option-3 rectangles are not converted or rendered as topology yet; see `docs/topology-a2-1.md` for the centre-line convention and validation boundary.

A2.2 adds deterministic wall insertion, endpoint reuse, T/X junction canonicalization, segment splitting, and explicit wall-ID remapping. It still does not convert Option-3 or change the editor UI; see `docs/topology-a2-2.md`.

A2.3 builds the Option-3 physical wall graph through those A2.2 operations and activates it in the normal ProjectV2 baseline. The fixed reference and V1 rectangles remain separate recovery sources, and semantic spaces/openings remain deferred; see `docs/topology-a2-3.md`.

A2.3.1 prevents that graph from becoming stale while the legacy rectangle UI remains active. Geometry edits demote topology, presentation-only changes preserve it, arbitrary V1 projects do not receive the stock graph, and active geometry must remain inside the current site. The dev-only overlay can be regenerated with `npm run diagnostic:topology-overlay`; see `docs/topology-a2-3-1.md`.

A2.4 deterministically derives 13 bounded faces for Option-3 from directed wall half-edges. Faces and exact areas are runtime products rather than persisted duplicate geometry; semantic rooms remain deferred. See `docs/topology-a2-4.md`.

## Construction note

The supplied PDF remains a visual reference. Property dimensions, permissions, setbacks, and regulations must be confirmed by a qualified architect and the relevant local authority before construction.
