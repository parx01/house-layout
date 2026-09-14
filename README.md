# Plan 66 house-plan editor

Plan 66 is a local SVG editor for inspecting and adjusting the OPTION-3 rectangle prototype. The A0/A1 foundation adds exact architectural units, a strict ProjectV2 save format, explicit site metadata, editable design targets, and automated tests without introducing shared-wall topology.

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

`npm run build` compiles the TypeScript foundation to `dist/foundation`. The existing SVG renderer remains a transitional legacy UI adapter until a later A2 stage supplies the curated Option-3 topology.

A2.1 establishes only the internal serialized topology graph. The current Option-3 rectangles are not converted or rendered as topology yet; see `docs/topology-a2-1.md` for the centre-line convention and validation boundary.

A2.2 adds deterministic wall insertion, endpoint reuse, T/X junction canonicalization, segment splitting, and explicit wall-ID remapping. It still does not convert Option-3 or change the editor UI; see `docs/topology-a2-2.md`.

## Construction note

The supplied PDF remains a visual reference. Property dimensions, permissions, setbacks, and regulations must be confirmed by a qualified architect and the relevant local authority before construction.
