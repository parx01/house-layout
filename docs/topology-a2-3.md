# A2.3 curated Option-3 topology reconciliation

A2.3 activates one purpose-built canonical wall graph for the existing Option-3 ground-floor baseline. `createOption3TopologyV2()` submits 17 observed physical wall runs to the A2.2 insertion engine in a fixed order. Intersections and terminating partitions are therefore canonicalized by the same splitting and node-reuse operations used by future topology work. The checked-in `fixtures/option-3-topology-v2.json` is the deterministic result.

This is not a general rectangle-to-topology migration. The topology is authoritative only for physical wall centre-lines. The fixed reference image and immutable V1 rectangles remain separate visual/recovery sources; spaces, faces, room names, staircase and courtyard semantics, openings, dimensions, coverage, wall ownership, and editing remain deferred.

## Reconciliation result

- Canonical nodes: 29.
- Canonical wall segments after junction splitting: 41.
- Junction nodes (degree 3 or 4): 23.
- T-junctions (degree 3): 22.
- Degree-4 intersections: 1, at the centre divider of the rear toilet/dress bank.
- Thicknesses: 228,600 µm (9 in) on the visually heavier perimeter runs and 114,300 µm (4.5 in) on the narrower partitions.
- Duplicate/reversed segments, coincident nodes, diagonal segments, collinear overlaps, and unsplit crossings: none.
- All centre-lines and their thickness bands remain inside the exact 49 ft 2 in by 79 ft 2 in property.
- The traced wall bands meet the current 4 ft side and 10 ft preferred rear design targets. No baseline wall was moved to obtain that result, and no regulatory claim is made.

## Centre-line derivation

Coordinates are exact integer micrometres in the established ProjectV2 property frame. They describe wall centres, not legacy room-box edges.

- The rear, left, and right heavy-wall centres use the legacy clear-room face plus or minus half of 9 in: x = 1,565,700 µm, x = 13,434,300 µm, and y = 3,165,700 µm. These placements also align with the paired heavy lines in the reference.
- Shared lines separated by the legacy 114–115 mm tracing gaps use the midpoint only after the same physical wall is visible in the reference. This gives the central step at x = 4,788,500 µm, rear partitions at x = 5,701,000 / 7,495,500 / 9,299,000 µm, the rear-to-central line at y = 7,909,500 µm, the kitchen-to-stair line at y = 12,945,500 µm, and the central-to-front line at y = 14,126,500 µm.
- The puja-to-kitchen centre at y = 9,547,800 µm is derived from the reference's 5 ft clear depth plus two half-partition offsets, reconciled against the V1 trace.
- The rear wet-room split at y = 6,080,350 µm is derived from the labelled 9 ft clear toilet depth and a half 4.5 in partition offset. It is not the touching edge of two independently boxed legacy rooms.
- The front partitions at x = 8,255,600 µm and 9,893,900 µm use the labelled 11 ft living width and 5 ft wet-area width with half-partition offsets. The front wet-room split at y = 15,650,500 µm similarly uses the labelled 4 ft 7.5 in wash depth.
- The front heavy-wall centre at y = 18,870,000 µm reconciles the labelled 15 ft front-room depth with the reference and the more consistent guest-room trace.
- The staircase-side outer return at y = 16,050,000 µm is the least certain placement. Its physical line and stepped footprint are clear in the reference, but the trace is approximate; the V1 staircase extent was used as the smallest explicit assumption. This is not verified construction information.

The 9 in and 4.5 in values reproduce the two clearly different line bands in the drawing and the legacy half-wall/gap evidence. They are documented geometric assumptions, not surveyed construction dimensions, structural classifications, or assertions of load-bearing status.

## Legacy geometry intentionally excluded

- Independent copies of touching room edges are not present; each physical shared wall appears once.
- The open/pass-through side between the puja area and lobby is not closed merely to make the legacy puja rectangle a box.
- Door arcs and door-width gaps are not topology yet. Where a doorway interrupts an otherwise clear host wall, A2.3 retains one continuous canonical host run for later opening subtraction.
- Windows, ventilation symbols, fixtures, furniture, stair treads/direction marks, dashed projection lines, setback lines, and property annotations are not walls.
- The old common-area adjustment and 1,969.11 sq ft estimate do not influence topology.

## Verification boundary

Tests rebuild the fixture through A2.2, compare deterministic identities and ordering, run A2.1 validation, inspect representative shared walls and T/degree-4 junctions, enforce exact integer orthogonal geometry and positive thickness, reject duplicate/coincident/overlapping structures through validation, check the exact property boundary, round-trip active topology through ProjectV2, and retain both A1 revision migration and V1 recovery. No production topology renderer or editor behavior is introduced in A2.3.
