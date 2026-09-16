# ProjectV2 A0/A1 boundary

ProjectV2 contains an exact site model and an explicitly isolated legacy editor snapshot:

```text
ProjectV2
├─ schemaVersion: 2
├─ schemaRevision: 6
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
├─ spaces: deferred slot or active semantic-space model v2
├─ openings: deferred versioned-model slot
├─ dimensions: deferred versioned-model slot
├─ siteObjects: deferred versioned-model slot
├─ legacyEditorState
└─ recovery fixture and reference-image identity
```

## General-editor decision

ProjectV2 is now explicitly considered the **historical/transitional Option-3 project contract**, not the permanent schema for the finished editor.

The accepted product architecture requires Plan 66 to support arbitrary user-authored orthogonal floor plans and new projects that do not depend on Option-3 fixtures, IDs, reference images, legacy rectangles, or its specific 66% rule.

Current ProjectV2 semantics hard-code several Option-3-specific concepts, including project identity/recovery and the current site's policy/provenance shape. Those meanings must remain frozen for compatibility rather than being silently broadened.

Therefore the existing schema-evolution rule is now concretely triggered:

> Before general topology authoring is considered complete, introduce `schemaVersion: 3` (or the next explicit major schema) and an explicit ProjectV2 → ProjectV3 migration.

The generic next-major project schema must support at least:

- arbitrary persistent project identity/name
- new project creation without Option-3 recovery/reference assets
- empty or active canonical topology
- semantic spaces that can be created by the user as faces emerge
- project-specific rectangular site dimensions initially
- project-specific front/road/orientation metadata
- a generic rational coverage-policy/provenance model, including a not-configured state if appropriate
- stable versioned topology/space/opening/dimension/site-object submodels
- strict validation and deterministic migration.

ProjectV2 remains fully supported as an Option-3 migration/reference document. See `docs/general-floor-plan-editor-architecture.md`.

## Schema-evolution policy

`schemaVersion: 2` has an explicit `schemaRevision: 6`. Openings, dimensions, and site objects remain stable deferred envelopes with `status: "deferred"`, a target stage, and `modelVersion: null` / `data: null`. A2.1 activated the already-reserved topology key with a separately versioned and strictly validated canonical node/wall graph. A3.1 activated the already-reserved spaces key with a separately versioned semantic model; A3.2 populates that model only for the untouched curated Option-3 baseline, and A3.5 revision 6 adds explicit role/enclosure semantics.

A2.3.1 advanced revision 3 because `building.status` truthfully distinguishes `topologyActive` and `topologyDeferred`. Revision-2 saves migrate explicitly: the released curated A2.3 graph remains active, while deferred/empty topology remains non-active. Its temporary equality-to-legacy authority rule was later superseded by A2.6.1; current protection comes from structural validation and site/band containment.

A3.1 advanced to revision 4 rather than changing revision 3 in place. A revision-3 file is accepted only if its spaces slot has the historical deferred shape. Active semantic spaces require active topology and bind persistent `SpaceId` values to currently derived `FaceId` values without storing polygons or areas.

A2.6.1 advances to revision 5 because canonical topology is now authoritative independently of `legacyEditorState`. Revision-4 files migrate explicitly. Current validation accepts any structurally valid, site-contained active topology, while the project-level A2.5 transaction preserves semantic bindings only when their derived face IDs survive. Legacy rectangles can differ without invalidating canonical topology.

A3.5 advances to revision 6. Revision-4/5 semantic model V1 saves migrate without guessing architectural meaning: their bindings survive and their new `architecturalRole`/`enclosure` fields become explicit `unclassified` values. Such a project remains structurally recoverable but cannot pass the A3-complete gate or produce complete architectural understanding until reviewed.

A3.2 does not change the schema or persist derived geometry. It activates 13 explicit SpaceId-to-FaceId bindings for a newly created untouched Option-3 baseline. Explicit V1 recovery—including the original V1 fixture—and arbitrary or edited migrations remain semantically deferred unless a mapping is already present and validates; no geometric remapping is attempted.

The original A1 ProjectV2 documents had no `schemaRevision`, future-model slots, or road-width provenance. The loader recognizes exactly that frozen top-level shape and performs a one-way normalization to current revision 6 with deferred topology and spaces. Unknown fields and unknown explicit revisions remain errors. Automated coverage preserves an A1-shaped save, reloads it, verifies all deferred slots, and round-trips the normalized document.

Do not reinterpret ProjectV2 fields for generic authoring. General document identity/reference/site-policy changes belong to ProjectV3 and explicit migration.

## Road-width provenance

The front road edge remains known for Option-3. `road.widthUm` is 12,000,000 because the supplied `OPTION-3.pdf` drawing explicitly says `ROAD 12.00M WIDE`. Its metadata is deliberately recorded as `referencePlanSuppliedUnverified`; it is not treated as an independently surveyed or regulatory value and must not become a generic-project default.

## Reference-image calibration

The reference image stays fixed to the original 49 ft 2 in by 79 ft 2 in Option-3 calibration. Editing experimental site frontage/depth updates the property boundary, grid, buildable target overlays, calculations, and drawing frame, but does not stretch the source image.

Future generic projects may have no reference image at all; this fixed calibration is a ProjectV2/Option-3 recovery concern.

The legacy room rectangles remain available only so the historical prototype can continue to be inspected/recovered. They are not an intermediate canonical geometry model and are not used as an authoritative building footprint.

The side and rear values are editable design targets, not verified regulatory setbacks. `frontMinUm` remains `null`. The warning vocabulary reserves `regulatoryViolation`, but no verified local regulation dataset has been supplied.
