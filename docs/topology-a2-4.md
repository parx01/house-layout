# A2.4 derived bounded faces

A2.4 derives planar bounded faces directly from active `TopologyV2`. The wall
graph remains the sole persisted geometric source of truth: face polygons are
runtime output and ProjectV2 `spaces` remains deferred. Legacy rectangles are
not read by the extractor.

## Deterministic half-edge traversal

1. Validate the canonical topology before traversal.
2. Find graph bridges with a deterministic depth-first search. A bridge cannot
   bound a planar face, so its two directed half-edges are omitted and its wall
   ID is reported in `ignoredBridgeWallIds`.
3. Create forward and reverse half-edges for every remaining wall. At each node,
   order outgoing half-edges clockwise in the ProjectV2 coordinate frame
   (east, south, west, north).
4. Follow the predecessor of the incoming twin at every destination node. This
   keeps a bounded face on the right of its walk.
5. Use exact integer shoelace arithmetic. Positive-area walks are clockwise
   bounded faces in the downward-Y coordinate frame; negative walks are
   exterior boundary walks and are excluded.

Traversal starts from sorted half-edge keys. Each bounded cycle is rotated to
its lexicographically smallest directed edge, then assigned a stable 64-bit
FNV-1a ID from the complete directed-edge signature. Returned faces are sorted
by that ID, so record insertion order cannot affect output.

## Boundary and geometry contract

Each `DerivedBoundedFace` contains:

- `boundary`: ordered `{ wallId, direction }` references, where `forward`
  follows the wall's stored start-to-end direction and `reverse` opposes it;
- `vertices`: derived canonical node IDs and exact integer micrometre
  coordinates in the same order;
- `winding: clockwise`;
- `areaUm2`: exact whole-square-micrometre shoelace area.

The boundary therefore preserves canonical wall/node identity and gives an
unambiguous orientation without storing a second editable polygon model.

## Edge cases and explicit limits

- Shared walls appear once in topology and can occur in two faces with opposite
  half-edge directions.
- T-junctions, four-way intersections, and straight degree-2 nodes are retained
  in their canonical connectivity.
- Dangling walls and acyclic branches are reported as ignored bridges and do
  not create self-touching pseudo-faces.
- Multiple adjacent faces and disconnected non-overlapping face components are
  supported.
- Unsplit intersections, overlaps, coincident nodes, invalid references, and
  non-orthogonal walls fail canonical topology validation before extraction.
- Zero-area or repeated-node bounded walks fail explicitly.
- Nested disconnected cycles would require a face-with-holes representation.
  A2.4 rejects their overlapping derived interiors explicitly rather than
  returning geometrically misleading faces.

Because valid orthogonal topology forbids crossings and a returned bounded walk
cannot repeat a node, every returned boundary is a simple, non-self-intersecting
polygon. A2.4 assigns no room labels or other architectural semantics.

## Option-3 result

The unchanged curated Option-3 topology (29 nodes and 41 walls) derives exactly
13 bounded faces, no ignored bridge walls, and one excluded exterior walk. A
golden test fixes every derived face ID, exact area, and boundary length, while
additional assertions verify clockwise winding and every directed canonical
wall/node reference.

Semantic room mapping, courtyard meaning, wall roles, openings, coverage, and
topology editing remain deferred to later reviewed stages.
