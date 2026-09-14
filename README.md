# Plan 66 house-plan editor

## Open it

Open `dist/index.html` in Google Chrome. The editor is completely local and does not need an internet connection.

Keep the entire `dist` folder together because the HTML uses the nearby CSS, JavaScript, and reference-plan image.

## Edit the plan

- **Move a room:** choose **Select**, then drag the room.
- **Resize a room:** select it, then drag an edge or corner handle.
- **Remove one side of a room:** click that wall, then choose **Delete**.
- **Add a room:** choose **Add room**, then drag on the plan.
- **Add a wall:** choose **Add wall**, then drag from its start to its end.
- **Rename or size precisely:** select a room and use the inspector on the right.
- **Undo or redo:** use the arrow buttons or `Ctrl+Z` / `Ctrl+Y`.

Your latest plan is saved automatically in that browser. **Save project** also downloads a JSON backup, and **Export SVG** creates a vector drawing that can later be imported into CAD software.

## 66% coverage rule

The limit is kept as a fixed calculation:

`maximum covered area = plot width in feet × plot depth in feet × 0.66`

For the supplied **49.21 ft × 79.23 ft** plot (the original 15.00 m × 24.15 m site):

- Plot area: **3,899.23 sq ft**
- 66% maximum: **2,573.49 sq ft**
- Starting design: **1,969.11 sq ft**
- Starting remaining allowance: **604.38 sq ft**

Room dimensions, wall lengths, site dimensions, and editable inputs are shown in feet. All area totals are shown in square feet. Dragging snaps to **0.25 ft**, and the coverage meter updates continuously. Overlapping rooms are counted once.

## Notes

The PDF is used as a visual tracing reference. Dimensions and permissions should be checked by your architect or local approving authority before construction.
