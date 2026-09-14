# ProjectV2 A0/A1 boundary

ProjectV2 contains an exact site model and an explicitly isolated legacy editor snapshot:

```text
ProjectV2
├─ schemaVersion: 2
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
├─ legacyEditorState
└─ recovery fixture and reference-image identity
```

The legacy room rectangles remain available only so the visible prototype can continue to be inspected. They are not an intermediate ProjectV2 geometry model and are not used as an authoritative building footprint.

The side and rear values are editable design targets, not verified regulatory setbacks. `frontMinUm` remains `null`. The warning vocabulary reserves `regulatoryViolation`, but A1 never emits that category because no verified local regulation dataset has been supplied.
