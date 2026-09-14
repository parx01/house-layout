# A2.1 canonical topology architecture

ProjectV2's reserved `topology` slot accepts either the original deferred envelope or topology model version 1:

```ts
interface TopologyV2 {
  status: "empty" | "active";
  modelVersion: 1;
  nodes: Record<NodeId, TopologyNode>;
  walls: Record<WallId, TopologyWall>;
}

interface TopologyNode {
  id: NodeId;
  xUm: CoordinateUm;
  yUm: CoordinateUm;
}

interface TopologyWall {
  id: WallId;
  startNodeId: NodeId;
  endNodeId: NodeId;
  thicknessUm: LengthUm;
}
```

Nodes are canonical junctions with stable `n-...` identities and exact safe-integer micrometre coordinates. Walls have stable `w-...` identities and reference two canonical node IDs. One physical wall is stored exactly once; spaces never own wall copies. Connectivity exists only through shared node identity, not through separate nodes that happen to have equal coordinates. Coincident independent nodes are therefore invalid in committed topology.

Each wall is a **centre-line** between its endpoint nodes. `thicknessUm` extends equally to both sides when later rendering or offset geometry is implemented. Endpoint coordinates, orientation, and length are derived from nodes and are never stored on a wall. A2.1 permits only non-zero horizontal or vertical segments and never snaps invalid geometry. Thickness is positive exact `LengthUm`; it does not classify a wall as interior or exterior. That classification will derive from future face adjacency.

Exact duplicate node pairs, including reversed pairs, are rejected. A2.1 intentionally deferred general collinear-overlap detection and intersection splitting; A2.2 now supplies those canonical construction rules in `topology-a2-2.md`. A committed T-junction or X-intersection uses an explicit shared node and split canonical segments.

A2.1 does not provide movement transactions, wall offsets, face/space extraction, room polygons, Option-3 conversion, coverage, openings, snapping, dimensions, or topology rendering. Spaces and openings remain deferred. Option-3 continues to use the untouched legacy rectangle adapter until A2.3 conversion is reviewed.
