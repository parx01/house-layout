# ProjectV2 A0/A1 boundary

ProjectV2 contains an exact site model and an explicitly isolated legacy editor snapshot:

```text
ProjectV2
├─ schemaVersion: 2
├─ schemaRevision: 4
├─ units: "um"
├─ coordinateSystem
├─ site
│  ├─ rectangular boundary
│  ├─ front edge and road metadata
│  ├─ north/orientation metadata
│  ├─ supplied 66% coverage rule
│  └─ editable design setbacks
├─ building
│  ├─ physical topology: active in the Option-3 A2.3 baseline
│  └─ authoritative footprint coverage: deferred to A4
├─ topology: canonical A2.1 node/wall graph (active in the normal Option-3 baseline)
├─ spaces: deferred slot or active semantic-space model v1
├─ openings: deferred versioned-model slot
├─ dimensions: deferred versioned-model slot
├─ siteObjects: deferred versioned-model slot
├─ legacyEditorState
└─ recovery fixture and reference-image identity
```

## Schema-evolution policy

`schemaVersion: 2` has an explicit `schemaRevision: 4`. Openings, dimensions, and site objects remain stable deferred envelopes with `status: "deferred"`, a target stage, and `modelVersion: null` / `data: null`. A2.1 activated the already-reserved topology key with a separately versioned and strictly validated canonical node/wall graph. A3.1 activates the already-reserved spaces key with a separately versioned semantic model while keeping the Option-3 baseline itself deferred until A3.2.

A2.3.1 advanced revision 3 because `building.status` truthfully distinguishes `topologyActive` and `topologyDeferred`. Revision-2 saves migrate explicitly: the released curated A2.3 graph remains active, while deferred/empty topology remains non-active. Active topology is additionally checked against the known baseline legacy geometry and current property boundary. Geometry changes made through the legacy editor demote topology instead of silently retaining a stale graph.

A3.1 advances to revision 4 rather than changing revision 3 in place. A revision-3 file is accepted only if its spaces slot has the historical deferred shape, then migrated to revision 4. Active semantic spaces are valid only in revision 4, require active topology, and bind persistent `SpaceId` values to currently derived `FaceId` values without storing polygons or areas. If legacy geometry invalidates topology, active spaces are demoted atomically because their face bindings can no longer be trusted.

The original A1 ProjectV2 documents had no `schemaRevision`, future-model slots, or road-width provenance. The loader recognizes exactly that frozen top-level shape and performs a one-way normalization to current revision 4 with deferred topology and spaces. Unknown fields and unknown explicit revisions remain errors. Automated coverage preserves an A1-shaped save, reloads it, verifies all deferred slots, and round-trips the normalized document.

If later work cannot fit cleanly in the reserved/versioned slots, it must introduce `schemaVersion: 3` and an explicit ProjectV2-to-ProjectV3 migration instead of changing ProjectV2 semantics.

## Road-width provenance

The front road edge remains known. `road.widthUm` is 12,000,000 because the supplied `OPTION-3.pdf` drawing explicitly says `ROAD 12.00M WIDE`. Its metadata is deliberately recorded as `referencePlanSuppliedUnverified`; it is not treated as an independently surveyed or regulatory value.

## Reference-image calibration

The reference image stays fixed to the original 49 ft 2 in by 79 ft 2 in Option-3 calibration. Editing experimental site frontage/depth updates the property boundary, grid, buildable target overlays, calculations, and drawing frame, but does not stretch the source image.

The legacy room rectangles remain available only so the visible prototype can continue to be inspected. They are not an intermediate ProjectV2 geometry model and are not used as an authoritative building footprint.

The side and rear values are editable design targets, not verified regulatory setbacks. `frontMinUm` remains `null`. The warning vocabulary reserves `regulatoryViolation`, but A1 never emits that category because no verified local regulation dataset has been supplied.
