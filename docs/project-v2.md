# ProjectV2 A0/A1 boundary

ProjectV2 contains an exact site model and an explicitly isolated legacy editor snapshot:

```text
ProjectV2
├─ schemaVersion: 2
├─ schemaRevision: 2
├─ units: "um"
├─ coordinateSystem
├─ site
│  ├─ rectangular boundary
│  ├─ front edge and road metadata
│  ├─ north/orientation metadata
│  ├─ supplied 66% coverage rule
│  └─ editable design setbacks
├─ building
│  ├─ topology: deferred to A2
│  └─ authoritative footprint coverage: deferred to A4
├─ topology: deferred slot or canonical A2.1 node/wall graph
├─ spaces: deferred versioned-model slot
├─ openings: deferred versioned-model slot
├─ dimensions: deferred versioned-model slot
├─ siteObjects: deferred versioned-model slot
├─ legacyEditorState
└─ recovery fixture and reference-image identity
```

## Schema-evolution policy

`schemaVersion: 2` has an explicit `schemaRevision: 2`. Four future-model keys remain stable deferred envelopes with `status: "deferred"`, a target stage, and `modelVersion: null` / `data: null`. A2.1 activates the already-reserved topology key with a separately versioned and strictly validated canonical node/wall graph. It does not add a ProjectV2 top-level key or reinterpret the legacy editor rectangles as topology.

The original A1 ProjectV2 documents had no `schemaRevision`, future-model slots, or road-width provenance. The loader recognizes exactly that frozen top-level shape as revision 1 and performs a one-way revision-1-to-revision-2 normalization. Unknown fields and unknown explicit revisions remain errors. Automated coverage preserves an A1-shaped save, reloads it, verifies all deferred slots, and round-trips the normalized document.

If later work cannot fit cleanly in the reserved/versioned slots, it must introduce `schemaVersion: 3` and an explicit ProjectV2-to-ProjectV3 migration instead of changing ProjectV2 semantics.

## Road-width provenance

The front road edge remains known. `road.widthUm` is 12,000,000 because the supplied `OPTION-3.pdf` drawing explicitly says `ROAD 12.00M WIDE`. Its metadata is deliberately recorded as `referencePlanSuppliedUnverified`; it is not treated as an independently surveyed or regulatory value.

## Reference-image calibration

The reference image stays fixed to the original 49 ft 2 in by 79 ft 2 in Option-3 calibration. Editing experimental site frontage/depth updates the property boundary, grid, buildable target overlays, calculations, and drawing frame, but does not stretch the source image.

The legacy room rectangles remain available only so the visible prototype can continue to be inspected. They are not an intermediate ProjectV2 geometry model and are not used as an authoritative building footprint.

The side and rear values are editable design targets, not verified regulatory setbacks. `frontMinUm` remains `null`. The warning vocabulary reserves `regulatoryViolation`, but A1 never emits that category because no verified local regulation dataset has been supplied.
