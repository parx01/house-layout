# A3 semantic-space closure

A3 closes with canonical topology as geometry and semantic spaces as persistent meaning. It does not calculate footprint, coverage, or true exterior walls.

## Persistent and derived data

ProjectV2 persists only each space's `SpaceId`, name, category, `architecturalRole`, `enclosure`, and current `FaceId` binding. It does not persist polygons, face vertices, centre-line area, clear area, dimensions, adjacency, wall relationships, or label anchors.

A2.4 derives `FaceId` and face geometry from topology. A3.4 derives centre-line area, wall-face clear geometry, adjacency, wall relationships, and label anchors at runtime. A rectangular clear region may expose width and depth; an irregular region reports `notSimpleRectangle` with useful dimension segments instead of a fabricated width × depth.

`SpaceId` is the stable semantic identity. `FaceId` is derived geometry identity and may change after a safe wall split or replacement.

## A3-complete invariant

Structural ProjectV2 validation remains able to recover historical revisions. The explicit A3-complete gate is stronger:

- topology and semantic spaces are active;
- every bounded A2.4 face is claimed by exactly one space;
- every space binds one existing face;
- `SpaceId` values and exclusive face bindings are unique;
- no binding is orphaned;
- `architecturalRole` and `enclosure` are not `unclassified`.

Revision-4/5 saves migrate without semantic guessing. Their preserved bindings receive explicit `unclassified` role/enclosure values, so they remain structurally loadable but cannot be treated as A3-complete until reviewed. A1, A2, and revision-3 saves retain their documented deferred semantic state.

## Rebinding and remapping

Normal A2.5 moves preserve surviving `SpaceId` to `FaceId` bindings. A wall split or replacement may rebind when overlap, containment, shared canonical boundary, and one-to-one correspondence are unambiguous.

Face splits, merges, orphaned faces, ambiguous correspondence, and any newly created unclaimed bounded face return `remapRequired`. No `SpaceId` is created or deleted automatically. A failed or remap-required update does not modify the original project.

## Role and enclosure

`architecturalRole` records ordinary room, circulation, staircase, service, storage, courtyard/void, other special use, or explicit unclassified state. `enclosure` records covered enclosure, open-to-sky, or explicit unclassified state. Neither field is a coverage decision, and category never implies either field.

Option-3 has 13 bounded faces and 13 explicitly classified spaces. None is a bounded open-to-sky courtyard. Synthetic open-to-sky courtyard support remains part of the contract for later A4 work.

## Wall terminology

A3.4 exposes `wallsWithoutSemanticNeighbor`: walls for which the opposite derived face has no semantic space. This is deliberately not named or interpreted as an exterior wall. True exterior-envelope classification belongs to A4.

## A4 reliance boundary

A4 may rely on canonical topology, exact derived faces, complete exclusive face ownership, stable semantic identity, explicit role/enclosure values, deterministic rebinding reports, clear wall-face geometry, and the absence of silently unclaimed faces in an A3-complete project.

A4 must still derive the exterior envelope and define coverage policy. A3 does not provide `countsTowardCoverage`, footprint area, coverage calculation, or exterior-wall classification.
