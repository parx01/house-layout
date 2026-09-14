# A2.2 canonical topology operations

A2.2 adds immutable centre-line construction operations around the A2.1 graph. The high-level primitive is `insertWall(topology, proposal, { idSeed })`: it validates the input graph and proposed exact-integer orthogonal segment, calculates a copy-on-write candidate, reuses or creates canonical nodes, splits every affected segment, validates the result, and only then returns it. Failure never mutates the input topology.

## Intersection classification

`findWallIntersections` classifies exact centre-line relationships as:

- `endpointEndpoint`: existing node is reused; a straight continuation may remain a separate adjacent segment.
- `proposedEndpointToExistingInterior`: the existing wall is split at the shared junction.
- `existingEndpointToProposedInterior`: the inserted wall is split at the existing node.
- `interiorCrossing`: the existing and inserted walls are both split around one shared degree-4 node.
- `exactDuplicate`: rejected, including reversed direction.
- `collinearOverlap`: any positive-length partial or containing overlap is rejected.

Multiple crossings split the inserted wall at every intersection in canonical coordinate order. All calculations use exact safe-integer micrometres with no tolerance or automatic snapping. Thickness remains metadata and does not participate in centre-line intersection classification.

## Identity and remapping

Callers supply a stable `idSeed`; a local deterministic allocator produces `n-{seed}-{counter}` and `w-{seed}-{counter}` identities while skipping existing IDs. Coordinate ordering makes the same insertion deterministic even when its direction is reversed.

Walls unaffected by an insertion preserve their IDs. When an existing wall must split, its ID is removed and all coordinate-ordered replacement IDs are reported in `wallReplacements`. The result also reports created/removed nodes and walls plus the new wall's segment IDs. Adjacent collinear segments are not automatically merged because their shared node may be structurally meaningful.

Committed topology validation now also rejects positive-length collinear overlaps, nodes lying on unsplit wall interiors, and perpendicular intersections that have not been split into shared canonical nodes. Degree-1 through degree-4 nodes remain valid.

## Deferred work

A2.2 does not include Option-3 conversion, face or room extraction, spaces, wall dragging, moving junctions, constraints, openings, coverage, snapping, dimensions, offsets/mitres, or production rendering. Those remain review-gated later stages.
