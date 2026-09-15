# A2.6 topology-native read-only rendering

A2.6 moves the visible OPTION-3 plan from legacy rectangle rendering to a topology-native, read-only SVG view. It does not introduce production geometry editing.

## Geometry authority

- `ProjectV2.topology`, when active, is the only architectural geometry sent to the renderer.
- `createTopologySvgRenderModel()` validates the canonical graph, invokes A2.4 face extraction, and converts exact integer micrometres to the editor's millimetre SVG coordinate system.
- Derived faces remain runtime products. Their polygons and areas are not persisted as duplicate geometry.
- Legacy rectangles stay in `legacyEditorState` for compatibility and recovery. They render only when the user enables **Legacy comparison**, with no pointer events, and are removed from SVG exports.
- A deferred/stale topology shows an explicit unavailable state; the renderer does not silently fall back to legacy rooms.

## Visual representation

- Faces render beneath walls with restrained translucent fill. Each display label is the exact A2.4 area formatted in square feet and placed inside the orthogonal face.
- A physical wall renders once as a band centred on its canonical centre-line. SVG stroke width is exactly `thicknessUm / 1000`, so 4.5-inch and 9-inch walls remain visually distinct.
- A fine centre-line is display-only and does not alter geometry.
- Junction markers are derived directly from canonical nodes and expose their graph degree.
- The site boundary, design-target overlays, grid, fixed reference image, and independent zoom/scroll viewport retain their existing coordinate conventions and layer hierarchy.

## Interaction boundary

Faces, physical walls, and junctions expose keyboard-focusable selection hit targets. Selection displays derived area/boundary data, canonical wall length/thickness/endpoints, or junction degree/coordinates. No room name or semantic-space mapping is inferred.

Add-room, add-wall, delete, dragging, snapping mutations, typed topology dimensions, openings, coverage semantics, and other Phase B interactions remain out of scope and disabled.

## Verification

The pure renderer adapter is covered for:

- deterministic Option-3 counts: 13 faces, 41 walls, and 29 junctions;
- exact wall thickness scaling and centre-line orientation;
- directed canonical wall references and interior face-label placement;
- shared-wall deduplication and opposite directed use by adjacent faces;
- deterministic output independent of record insertion order.

Static UI contract tests protect layer order, canonical-only default rendering, opt-in/non-interactive legacy comparison, hit targets, disabled geometry controls, and derived-only selection details.

Browser verification at 100% and 145% zoom confirmed alignment with the fixed Option-3 reference. At 145%, the canvas was 1065 x 842 px inside a 735 x 581 px viewport; horizontal and vertical canvas scroll changed while page scroll remained at zero.
