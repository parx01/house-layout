# A2.5 transactional topology movement

A2.5 adds pure canonical geometry transactions. It does not add production UI,
snapping, semantic spaces, coverage, openings, or wall-role classification.
ProjectV2 persistence is unchanged.

## Wall movement

`moveWallPerpendicular(topology, wallId, offsetUm)` moves a wall perpendicular
to its orientation using an exact integer-micrometre offset.

A canonical physical run can contain multiple segments because a T- or
four-way junction split it. Selecting any segment therefore identifies the
maximal connected collinear run. Every node on that run receives the same
perpendicular displacement, every run segment keeps its ID, and perpendicular
walls resize through their existing shared endpoints. No node, wall, endpoint
reference, or thickness is created, removed, or replaced.

## Junction movement

`moveJunction(topology, nodeId, target)` accepts one exact target coordinate.
Orthogonality is propagated minimally as two independent constraints:

- all nodes connected to the junction through vertical walls receive its X
  displacement;
- all nodes connected through horizontal walls receive its Y displacement.

This allows a corner or T/X junction to move in both axes without disconnecting
shared nodes or turning any incident segment diagonal. Perpendicular branches
resize naturally; continued same-axis runs remain straight.

## Transaction gate

Both operations follow the same commit protocol:

1. strictly validate the input topology and exact integer movement;
2. derive the existing A2.4 bounded faces;
3. build changes on a canonical deep copy;
4. validate the complete candidate with `validateTopologyV2`;
5. derive candidate faces with `extractBoundedFaces`;
6. require the same face count and the same stable face-boundary IDs;
7. return the candidate only after every check succeeds.

The stable face-ID check is intentionally stronger than count alone. It rejects
a wall or corner moved past its opposite boundary: that final graph can remain
orthogonal and retain one face numerically, but its directed boundary has
inverted. Collapsed faces, coincident nodes, zero-length walls, collinear
overlaps, and unsplit crossings fail earlier topology validation.

All rejection paths throw `TopologyMoveError` with an explicit stage and never
mutate the input. There are no tolerances, rounded coordinates, random IDs, or
partial commits.

## Transaction metadata

Successful operations return the committed topology plus deterministic metadata
for later undo and preview layers:

- exact before/after coordinates for each moved node;
- affected, translated, and resized wall IDs;
- the selected collinear wall run or junction constraint-node sets;
- preserved face IDs and before/after face counts;
- exact before/after area for every face whose area changed.

Metadata and topology records are ID-sorted, so equivalent input record orders
produce identical results.

## Option-3 verification

Representative moves of the split front wet-area partition and its T-junction
preserve all 29 node IDs, 41 wall IDs, connectivity, thicknesses, and 13 bounded
face IDs. The curated A2.3 fixture itself remains unchanged.

A2.6 and all production interaction work remain outside this stage.
