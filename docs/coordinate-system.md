# ProjectV2 coordinate and orientation convention

- Model origin `(0,0)` is the rear-left property corner when the front/road edge is drawn at the bottom.
- `+X` runs left to right across the rendered plan.
- `+Y` runs from the rear boundary toward the front/road boundary. This matches SVG's downward-positive Y axis.
- A rectangular property boundary is listed clockwise as rear-left, rear-right, front-right, front-left.
- `frontEdgeIndex` identifies the directed edge from vertex `i` to vertex `(i + 1) mod 4`. For Option 3, edge `2` is the front edge (front-right to front-left).
- `northAngleDeg` is the clockwise rendered angle from screen-up (model `-Y`) to true north. `0` points to the top of the plan; `90` points right. It is `null` until north is established from authoritative information.
- Positive geometry rotation is clockwise in the rendered SVG view. The road-at-bottom presentation is a view convention and does not imply that north is at the rear.

All model lengths are stored internally as integer micrometres. Screen pixels and legacy editor millimetres are adapter values, not model units.
