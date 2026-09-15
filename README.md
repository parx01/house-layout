# Plan 66 house-plan editor

Plan 66 is a local SVG editor for inspecting the OPTION-3 canonical physical-wall topology and its derived bounded faces. In A2.6 the visible plan is topology-native and read-only; legacy rectangles remain compatibility/reference data and can be shown only through the optional comparison overlay.

## Open it

Serve the `dist` folder from a local web server, then open the printed local URL in Chrome. For example:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8765/`. Keep the entire `dist` folder together because the editor loads its compiled foundation, stylesheet, and preserved reference image from nearby files.

## Inspect the canonical plan

- Select a bounded face to inspect its exact derived area and directed-wall boundary count.
- Select a physical wall to inspect its canonical ID, centre-line length, endpoints, and thickness.
- Select a junction to inspect its canonical ID, degree, and exact coordinates.
- Toggle **Legacy comparison** only when comparing the old rectangle tracing against canonical geometry.
- Zoom with the toolbar and scroll the drawing viewport independently when the plan is larger than the canvas.
- Room/wall creation, deletion, and geometry dragging remain disabled until the later interaction phase.

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
- `src/topology`: canonical node/wall graph, structural validation, A2.2 insertion/splitting, and A2.5 transactional movement operations.
- `src/spaces`: A2.4 renderer-independent, derived bounded-face extraction from canonical topology.
- `src/persistence`: schema detection, V1 recovery wrapping, ProjectV2 serialization, and browser storage.
- `src/ui`: legacy compatibility plus the pure topology-to-SVG render adapter.
- `fixtures`: immutable original V1 state and reference-image identity.
- `docs`: ProjectV2 boundary and coordinate/orientation convention.
- `test`: Vitest coverage for units, site calculations, validation, recovery, and preserved assets.

Install dependencies once, then run:

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` compiles the TypeScript foundation to `dist/foundation`.

A2.1 establishes only the internal serialized topology graph. The current Option-3 rectangles are not converted or rendered as topology yet; see `docs/topology-a2-1.md` for the centre-line convention and validation boundary.

A2.2 adds deterministic wall insertion, endpoint reuse, T/X junction canonicalization, segment splitting, and explicit wall-ID remapping. It still does not convert Option-3 or change the editor UI; see `docs/topology-a2-2.md`.

A2.3 builds the Option-3 physical wall graph through those A2.2 operations and activates it in the normal ProjectV2 baseline. The fixed reference and V1 rectangles remain separate recovery sources, and semantic spaces/openings remain deferred; see `docs/topology-a2-3.md`.

A2.3.1 prevents that graph from becoming stale while the legacy rectangle UI remains active. Geometry edits demote topology, presentation-only changes preserve it, arbitrary V1 projects do not receive the stock graph, and active geometry must remain inside the current site. The dev-only overlay can be regenerated with `npm run diagnostic:topology-overlay`; see `docs/topology-a2-3-1.md`.

A2.4 deterministically derives 13 bounded faces for Option-3 from directed wall half-edges. Faces and exact areas are runtime products rather than persisted duplicate geometry; semantic rooms remain deferred. See `docs/topology-a2-4.md`.

A2.5 adds pure perpendicular wall-run and orthogonality-preserving junction movement. Candidate copies must pass topology validation and retain the same A2.4 face boundaries before they are returned; no production dragging or persistence change is included. See `docs/topology-a2-5.md`.

A2.6 switches the SVG editor to canonical topology walls/nodes and A2.4-derived faces. Wall bands use exact centre-line thickness, every topology entity has a read-only hit target, and the old rectangles are available only as a non-interactive comparison layer. See `docs/topology-a2-6.md`.

A3.1 adds persistent semantic `SpaceId` records with strict bindings to currently derived faces. The Option-3 baseline remains unmapped and deferred until A3.2; no semantic editing UI or automatic remapping is included. See `docs/spaces-a3-1.md`.

A2.6.1 makes canonical topology authoritative independently of legacy rectangles and adds the validated project transaction for accepting A2.5 movement results. Site containment, truthful status, conservative V1 recovery, and explicit semantic-binding safety remain enforced. See `docs/topology-a2-6-1.md`.

## Construction note

The supplied PDF remains a visual reference. Property dimensions, permissions, setbacks, and regulations must be confirmed by a qualified architect and the relevant local authority before construction.
