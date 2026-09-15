import {
  areaToSquareFeet,
  calculateOption3CanvasViewBox,
  createOption3ProjectV2,
  decimalFeetToLength,
  formatArchitecturalLength,
  formatSquareFeet,
  foundationSummary,
  legacyMmToUm,
  lengthUmToLegacyMm,
  OPTION_3_REFERENCE_DEPTH_UM,
  OPTION_3_REFERENCE_WIDTH_UM,
  parseArchitecturalLength,
  projectToLegacyEditorState,
  readProjectFromStorage,
  serializeProject,
  updateProjectFromLegacyEditorState,
  validateProjectV2,
  writeProjectToStorage,
} from "./foundation/browser.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TEST_MODE = new URLSearchParams(window.location.search).has("test");
const MM_PER_FT = 304.8;
const FT2_TO_MM2 = 92_903.04;
const SNAP_MM = MM_PER_FT * 0.25;
const MIN_ROOM_MM = MM_PER_FT * 2.5;
let project = createOption3ProjectV2();
let projectLoadError = "";
let state = loadState();
let selected = null;
let activeTool = "select";
let drag = null;
let drawing = null;
let history = [];
let future = [];
let zoom = 1;
let toastTimer;

const svg = document.querySelector("#plan-svg");
const roomLayer = document.querySelector("#room-layer");
const wallLayer = document.querySelector("#wall-layer");
const siteLayer = document.querySelector("#site-layer");
const interactionLayer = document.querySelector("#interaction-layer");
const selectionForm = document.querySelector("#selection-form");
const emptySelection = document.querySelector("#empty-selection");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  if (TEST_MODE) {
    project = createOption3ProjectV2();
    return projectToLegacyEditorState(project);
  }
  try {
    project = readProjectFromStorage(localStorage);
    return projectToLegacyEditorState(project);
  } catch (error) {
    projectLoadError = error instanceof Error ? error.message : "The saved project is invalid.";
    project = createOption3ProjectV2();
    return projectToLegacyEditorState(project);
  }
}

function saveState() {
  const status = document.querySelector("#save-status");
  if (TEST_MODE) {
    status.textContent = "Test session";
    return;
  }
  status.textContent = "Saving…";
  status.classList.add("saving");
  window.setTimeout(() => {
    try {
      project = updateProjectFromLegacyEditorState(project, state);
      writeProjectToStorage(localStorage, project);
      status.textContent = "Saved as ProjectV2";
      status.classList.remove("saving");
    } catch (error) {
      status.textContent = "Save failed: invalid project";
      status.classList.remove("saving");
      showToast(error instanceof Error ? error.message : "Project validation failed");
    }
  }, 120);
}

function snapshot() {
  return { state: clone(state), project: clone(project) };
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateUndoButtons();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  ({ state, project } = history.pop());
  selected = null;
  render();
  saveState();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  ({ state, project } = future.pop());
  selected = null;
  render();
  saveState();
}

function updateUndoButtons() {
  document.querySelector("#undo").disabled = history.length === 0;
  document.querySelector("#redo").disabled = future.length === 0;
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function snap(value) {
  return state.snap ? Math.round(value / SNAP_MM) * SNAP_MM : Math.round(value);
}

function pointFromEvent(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: snap(transformed.x), y: snap(transformed.y) };
}

function formatFeet(mm) {
  return formatArchitecturalLength(legacyMmToUm(mm));
}

function formatSqFt(mm2) {
  return `${(mm2 / FT2_TO_MM2).toFixed(2)} sq ft`;
}

function unionArea(rectangles) {
  if (!rectangles.length) return 0;
  const xs = [...new Set(rectangles.flatMap((r) => [r.x, r.x + r.width]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const left = xs[i];
    const right = xs[i + 1];
    if (right <= left) continue;
    const intervals = rectangles
      .filter((r) => r.x < right && r.x + r.width > left)
      .map((r) => [r.y, r.y + r.height])
      .sort((a, b) => a[0] - b[0]);
    let coveredY = 0;
    let start = null;
    let end = null;
    intervals.forEach(([a, b]) => {
      if (start === null) {
        start = a;
        end = b;
      } else if (a <= end) {
        end = Math.max(end, b);
      } else {
        coveredY += end - start;
        start = a;
        end = b;
      }
    });
    if (start !== null) coveredY += end - start;
    area += (right - left) * coveredY;
  }
  return area;
}

function coverageValues() {
  const roomArea = unionArea(state.rooms.filter((room) => room.included));
  const designed = roomArea + state.commonAreaMm2;
  const siteSummary = foundationSummary(project);
  const plot = siteSummary.plotAreaUm2 / 1_000_000;
  const max = siteSummary.maximumCoverageUm2 / 1_000_000;
  return {
    roomArea,
    designed,
    plot,
    max,
    plotAreaUm2: siteSummary.plotAreaUm2,
    maximumCoverageUm2: siteSummary.maximumCoverageUm2,
    percent: plot ? (designed / plot) * 100 : 0,
    remaining: max - designed,
  };
}

function renderSite() {
  siteLayer.replaceChildren();
  const boundary = el("rect", {
    x: 0,
    y: 0,
    width: state.site.width,
    height: state.site.depth,
    class: "site-boundary",
  });
  siteLayer.append(boundary);

  const summary = foundationSummary(project);
  const envelope = summary.minimumEnvelope;
  siteLayer.append(el("rect", {
    x: lengthUmToLegacyMm(envelope.xUm),
    y: lengthUmToLegacyMm(envelope.yUm),
    width: lengthUmToLegacyMm(envelope.widthUm),
    height: lengthUmToLegacyMm(envelope.depthUm),
    class: "buildable-envelope",
  }));
  siteLayer.append(el("line", {
    x1: lengthUmToLegacyMm(summary.preferredEnvelope.xUm),
    y1: lengthUmToLegacyMm(summary.preferredEnvelope.yUm),
    x2: lengthUmToLegacyMm(summary.preferredEnvelope.xUm + summary.preferredEnvelope.widthUm),
    y2: lengthUmToLegacyMm(summary.preferredEnvelope.yUm),
    class: "preferred-rear-line",
  }));

  const road = el("text", {
    x: state.site.width / 2,
    y: state.site.depth - 420,
    class: "road-label",
  });
  road.textContent = project.site.road.widthUm === null
    ? "ROAD · FRONT EDGE"
    : `ROAD · ${formatArchitecturalLength(project.site.road.widthUm)} WIDE · PLAN NOTE`;
  siteLayer.append(road);
}

function wallEndpoints(room, side) {
  const x2 = room.x + room.width;
  const y2 = room.y + room.height;
  if (side === "top") return [room.x, room.y, x2, room.y];
  if (side === "right") return [x2, room.y, x2, y2];
  if (side === "bottom") return [room.x, y2, x2, y2];
  return [room.x, room.y, room.x, y2];
}

function renderRooms() {
  roomLayer.replaceChildren();
  state.rooms.forEach((room) => {
    const group = el("g", { "data-room-id": room.id });
    const shape = el("rect", {
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      class: `room-shape ${selected?.type === "room" && selected.id === room.id ? "selected" : ""}`,
      "data-action": "room",
      "data-id": room.id,
    });
    group.append(shape);

    ["top", "right", "bottom", "left"].forEach((side) => {
      if (room.hiddenSides.includes(side)) return;
      const [x1, y1, x2, y2] = wallEndpoints(room, side);
      group.append(
        el("line", {
          x1,
          y1,
          x2,
          y2,
          class: `room-wall ${selected?.type === "room-wall" && selected.id === room.id && selected.side === side ? "selected" : ""}`,
          "data-action": "room-wall",
          "data-id": room.id,
          "data-side": side,
        }),
      );
    });

    if (state.showLabels && room.width > 1200 && room.height > 1000) {
      const label = el("text", {
        x: room.x + room.width / 2,
        y: room.y + room.height / 2 - 70,
        class: "room-label",
      });
      label.textContent = room.name;
      group.append(label);
      const measure = el("text", {
        x: room.x + room.width / 2,
        y: room.y + room.height / 2 + 310,
        class: "room-measure",
      });
      measure.textContent = `${formatFeet(room.width)} × ${formatFeet(room.height)}`;
      group.append(measure);
    }
    roomLayer.append(group);
  });
}

function renderWalls() {
  wallLayer.replaceChildren();
  state.walls.forEach((wall) => {
    wallLayer.append(
      el("line", {
        x1: wall.x1,
        y1: wall.y1,
        x2: wall.x2,
        y2: wall.y2,
        class: `standalone-wall ${selected?.type === "wall" && selected.id === wall.id ? "selected" : ""}`,
        "data-action": "wall",
        "data-id": wall.id,
      }),
    );
  });
}

function renderHandles() {
  interactionLayer.replaceChildren();
  if (selected?.type === "room") {
    const room = state.rooms.find((item) => item.id === selected.id);
    if (!room) return;
    const handles = {
      top: [room.x + room.width / 2, room.y],
      right: [room.x + room.width, room.y + room.height / 2],
      bottom: [room.x + room.width / 2, room.y + room.height],
      left: [room.x, room.y + room.height / 2],
      northwest: [room.x, room.y],
      northeast: [room.x + room.width, room.y],
      southeast: [room.x + room.width, room.y + room.height],
      southwest: [room.x, room.y + room.height],
    };
    Object.entries(handles).forEach(([side, [cx, cy]]) => {
      interactionLayer.append(
        el("rect", {
          x: cx - 115,
          y: cy - 115,
          width: 230,
          height: 230,
          rx: 35,
          class: "resize-handle",
          "data-action": "resize-room",
          "data-id": room.id,
          "data-side": side,
        }),
      );
    });
  }
  if (selected?.type === "wall") {
    const wall = state.walls.find((item) => item.id === selected.id);
    if (!wall) return;
    [["start", wall.x1, wall.y1], ["end", wall.x2, wall.y2]].forEach(([endpoint, cx, cy]) => {
      interactionLayer.append(
        el("circle", {
          cx,
          cy,
          r: 145,
          class: "wall-handle",
          "data-action": "resize-wall",
          "data-id": wall.id,
          "data-endpoint": endpoint,
        }),
      );
    });
    const centerX = (wall.x1 + wall.x2) / 2;
    const centerY = (wall.y1 + wall.y2) / 2;
    interactionLayer.append(
      el("rect", {
        x: centerX - 165,
        y: centerY - 165,
        width: 330,
        height: 330,
        rx: 65,
        class: "wall-move-handle",
        "data-action": "move-wall-handle",
        "data-id": wall.id,
      }),
    );
  }
  if (selected?.type === "room-wall") {
    const room = state.rooms.find((item) => item.id === selected.id);
    if (!room) return;
    const [x1, y1, x2, y2] = wallEndpoints(room, selected.side);
    interactionLayer.append(
      el("rect", {
        x: (x1 + x2) / 2 - 165,
        y: (y1 + y2) / 2 - 165,
        width: 330,
        height: 330,
        rx: 65,
        class: "wall-move-handle",
        "data-action": "move-room-wall-handle",
        "data-id": room.id,
        "data-side": selected.side,
      }),
    );
  }
  if (drawing) {
    if (drawing.type === "wall") {
      interactionLayer.append(el("line", { x1: drawing.start.x, y1: drawing.start.y, x2: drawing.end.x, y2: drawing.end.y, class: "draw-preview" }));
    } else {
      const x = Math.min(drawing.start.x, drawing.end.x);
      const y = Math.min(drawing.start.y, drawing.end.y);
      interactionLayer.append(el("rect", { x, y, width: Math.abs(drawing.end.x - drawing.start.x), height: Math.abs(drawing.end.y - drawing.start.y), class: "draw-preview" }));
    }
  }
}

function renderCoverage() {
  const values = coverageValues();
  const over = values.remaining < 0;
  document.querySelector("#coverage-percent").textContent = values.percent.toFixed(2);
  document.querySelector("#plot-area").textContent = formatSquareFeet(values.plotAreaUm2, 4);
  document.querySelector("#max-covered").textContent = formatSquareFeet(values.maximumCoverageUm2, 4);
  document.querySelector("#designed-coverage").textContent = formatSqFt(values.designed);
  document.querySelector("#remaining-area").textContent = `${over ? "−" : ""}${formatSqFt(Math.abs(values.remaining))}`;
  const fill = document.querySelector("#coverage-bar-fill");
  fill.style.width = `${Math.min(100, Math.max(0, values.percent))}%`;
  fill.style.background = over ? "#ff7272" : "#18a999";
  const status = document.querySelector("#coverage-status");
  status.classList.toggle("over", over);
  status.querySelector("strong").textContent = over ? "Legacy estimate exceeds 66%" : "Legacy estimate is within 66%";
}

function renderSelection() {
  if (!selected) {
    selectionForm.hidden = true;
    emptySelection.hidden = false;
    selectionForm.replaceChildren();
    return;
  }
  emptySelection.hidden = true;
  selectionForm.hidden = false;
  if (selected.type === "room") {
    const room = state.rooms.find((item) => item.id === selected.id);
    if (!room) { selected = null; return renderSelection(); }
    selectionForm.innerHTML = `
      <div><div class="selection-name">${escapeHtml(room.name)}</div><div class="selection-type">Room</div></div>
      <label class="selection-field">Name <span><input name="name" value="${escapeHtml(room.name)}" style="width:130px;text-align:left"></span></label>
      <label class="selection-field">Width <span><input name="width" type="text" inputmode="text" value="${escapeHtml(formatFeet(room.width))}"></span></label>
      <label class="selection-field">Depth <span><input name="height" type="text" inputmode="text" value="${escapeHtml(formatFeet(room.height))}"></span></label>
      <div class="selection-field">Room area <span>${formatSqFt(room.width * room.height)}</span></div>
      <label class="coverage-check"><input name="included" type="checkbox" ${room.included ? "checked" : ""}> Count this room toward coverage</label>
      <div class="selection-actions"><button type="button" class="danger-button" data-delete>Delete room</button></div>`;
  } else if (selected.type === "room-wall") {
    const room = state.rooms.find((item) => item.id === selected.id);
    selectionForm.innerHTML = `
      <div><div class="selection-name">${escapeHtml(room?.name || "Room")} · ${selected.side} wall</div><div class="selection-type">Room wall</div></div>
      <p class="field-note">Clicking only selects this wall. Drag its amber handle to resize the room, or use Delete wall to create an opening.</p>
      <div class="selection-actions"><button type="button" class="danger-button" data-delete>Delete wall</button></div>`;
  } else {
    const wall = state.walls.find((item) => item.id === selected.id);
    const length = wall ? Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) : 0;
    selectionForm.innerHTML = `
      <div><div class="selection-name">Added wall</div><div class="selection-type">Independent wall</div></div>
      <label class="selection-field">Length <span>${formatFeet(length)}</span></label>
      <p class="field-note">Clicking only selects this wall. Drag the amber centre handle to move it, or drag either round endpoint to reshape it.</p>
      <div class="selection-actions"><button type="button" class="danger-button" data-delete>Delete wall</button></div>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  renderSite();
  renderRooms();
  renderWalls();
  renderHandles();
  renderCoverage();
  renderSelection();
  document.querySelector("#reference-layer").style.display = state.reference.show ? "block" : "none";
  document.querySelector("#reference-layer").style.opacity = state.reference.opacity;
  document.querySelector("#grid-layer").style.display = state.snap ? "block" : "none";
  document.querySelector("#grid-layer").setAttribute("width", String(state.site.width));
  document.querySelector("#grid-layer").setAttribute("height", String(state.site.depth));
  const referenceImage = document.querySelector("#reference-layer image");
  referenceImage.setAttribute("width", String(lengthUmToLegacyMm(OPTION_3_REFERENCE_WIDTH_UM)));
  referenceImage.setAttribute("height", String(lengthUmToLegacyMm(OPTION_3_REFERENCE_DEPTH_UM)));
  const viewBox = calculateOption3CanvasViewBox(
    project.site.boundary.widthUm,
    project.site.boundary.depthUm,
  );
  svg.setAttribute("viewBox", [
    lengthUmToLegacyMm(viewBox.xUm),
    lengthUmToLegacyMm(viewBox.yUm),
    lengthUmToLegacyMm(viewBox.widthUm),
    lengthUmToLegacyMm(viewBox.depthUm),
  ].join(" "));
  document.querySelector("#site-width").value = formatArchitecturalLength(project.site.boundary.widthUm);
  document.querySelector("#site-depth").value = formatArchitecturalLength(project.site.boundary.depthUm);
  document.querySelector("#common-area").value = (state.commonAreaMm2 / FT2_TO_MM2).toFixed(2);
  document.querySelector("#left-target").value = formatArchitecturalLength(project.site.designSetbacks.leftUm);
  document.querySelector("#right-target").value = formatArchitecturalLength(project.site.designSetbacks.rightUm);
  document.querySelector("#rear-min-target").value = formatArchitecturalLength(project.site.designSetbacks.rearMinUm);
  document.querySelector("#rear-preferred-target").value = formatArchitecturalLength(project.site.designSetbacks.rearPreferredUm);
  document.querySelector("#front-target").value = project.site.designSetbacks.frontMinUm === null
    ? "Flexible"
    : formatArchitecturalLength(project.site.designSetbacks.frontMinUm);
  document.querySelector("#north-status").textContent = project.site.orientation.northAngleDeg === null
    ? "Not established"
    : `${project.site.orientation.northAngleDeg}° clockwise from plan up`;
  document.querySelector("#show-reference").checked = state.reference.show;
  document.querySelector("#reference-opacity").value = Math.round(state.reference.opacity * 100);
  document.querySelector("#opacity-output").textContent = `${Math.round(state.reference.opacity * 100)}%`;
  document.querySelector("#snap-grid").checked = state.snap;
  document.querySelector("#show-labels").checked = state.showLabels;
  svg.dataset.tool = activeTool;
  updateUndoButtons();
}

function setTool(tool) {
  activeTool = tool;
  drawing = null;
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const copy = {
    select: ["Select and adjust", "Click a wall, then drag its visible handles"],
    room: ["Draw a room", "Drag on the plan to set its width and depth"],
    wall: ["Draw a wall", "Drag from one endpoint to the other"],
  }[tool];
  document.querySelector("#canvas-title").textContent = copy[0];
  document.querySelector("#canvas-hint").textContent = copy[1];
  renderHandles();
}

function startDrag(event, target) {
  const action = target.dataset.action;
  const start = pointFromEvent(event);
  if (action === "room") {
    const room = state.rooms.find((item) => item.id === target.dataset.id);
    selected = { type: "room", id: room.id };
    pushHistory();
    drag = { type: "move-room", id: room.id, start, original: clone(room) };
  } else if (action === "resize-room") {
    const room = state.rooms.find((item) => item.id === target.dataset.id);
    pushHistory();
    drag = { type: "resize-room", id: room.id, side: target.dataset.side, start, original: clone(room) };
  } else if (action === "room-wall") {
    const room = state.rooms.find((item) => item.id === target.dataset.id);
    selected = { type: "room-wall", id: room.id, side: target.dataset.side };
  } else if (action === "move-room-wall-handle") {
    const room = state.rooms.find((item) => item.id === target.dataset.id);
    pushHistory();
    drag = { type: "resize-room", id: room.id, side: target.dataset.side, start, original: clone(room) };
  } else if (action === "wall") {
    const wall = state.walls.find((item) => item.id === target.dataset.id);
    selected = { type: "wall", id: wall.id };
  } else if (action === "move-wall-handle") {
    const wall = state.walls.find((item) => item.id === target.dataset.id);
    pushHistory();
    drag = { type: "move-wall", id: wall.id, start, original: clone(wall) };
  } else if (action === "resize-wall") {
    const wall = state.walls.find((item) => item.id === target.dataset.id);
    pushHistory();
    drag = { type: "resize-wall", id: wall.id, endpoint: target.dataset.endpoint, original: clone(wall) };
  }
  if (drag) {
    svg.setPointerCapture(event.pointerId);
    render();
  }
}

function resizeRoom(room, original, side, point, start) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (side.includes("left") || side.includes("west")) {
    room.width = Math.max(MIN_ROOM_MM, original.width - dx);
    room.x = original.x + original.width - room.width;
  }
  if (side.includes("right") || side.includes("east")) {
    room.width = Math.max(MIN_ROOM_MM, original.width + dx);
  }
  if (side.includes("top") || side.includes("north")) {
    room.height = Math.max(MIN_ROOM_MM, original.height - dy);
    room.y = original.y + original.height - room.height;
  }
  if (side.includes("bottom") || side.includes("south")) {
    room.height = Math.max(MIN_ROOM_MM, original.height + dy);
  }
}

svg.addEventListener("pointerdown", (event) => {
  const target = event.target.closest("[data-action]");
  if (activeTool === "select" && target) {
    startDrag(event, target);
    return;
  }
  if (activeTool === "select") {
    selected = null;
    render();
    return;
  }
  const start = pointFromEvent(event);
  drawing = { type: activeTool, start, end: start };
  svg.setPointerCapture(event.pointerId);
  renderHandles();
});

svg.addEventListener("pointermove", (event) => {
  const point = pointFromEvent(event);
  if (drawing) {
    drawing.end = point;
    renderHandles();
    return;
  }
  if (!drag) return;
  if (drag.type === "move-room") {
    const room = state.rooms.find((item) => item.id === drag.id);
    room.x = snap(drag.original.x + point.x - drag.start.x);
    room.y = snap(drag.original.y + point.y - drag.start.y);
  } else if (drag.type === "resize-room") {
    const room = state.rooms.find((item) => item.id === drag.id);
    Object.assign(room, clone(drag.original));
    resizeRoom(room, drag.original, drag.side, point, drag.start);
  } else if (drag.type === "move-wall") {
    const wall = state.walls.find((item) => item.id === drag.id);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    wall.x1 = snap(drag.original.x1 + dx);
    wall.y1 = snap(drag.original.y1 + dy);
    wall.x2 = snap(drag.original.x2 + dx);
    wall.y2 = snap(drag.original.y2 + dy);
  } else if (drag.type === "resize-wall") {
    const wall = state.walls.find((item) => item.id === drag.id);
    if (drag.endpoint === "start") { wall.x1 = point.x; wall.y1 = point.y; }
    else { wall.x2 = point.x; wall.y2 = point.y; }
  }
  render();
});

svg.addEventListener("pointerup", () => {
  if (drawing) {
    const { start, end, type } = drawing;
    if (Math.hypot(end.x - start.x, end.y - start.y) > 300) {
      pushHistory();
      if (type === "wall") {
        const wall = { id: `wall-${Date.now()}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        state.walls.push(wall);
        selected = { type: "wall", id: wall.id };
      } else {
        const room = {
          id: `room-${Date.now()}`,
          name: `New Room ${state.rooms.length + 1}`,
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.max(MIN_ROOM_MM, Math.abs(end.x - start.x)),
          height: Math.max(MIN_ROOM_MM, Math.abs(end.y - start.y)),
          included: true,
          hiddenSides: [],
        };
        state.rooms.push(room);
        selected = { type: "room", id: room.id };
      }
      setTool("select");
      saveState();
    }
    drawing = null;
  }
  if (drag) {
    drag = null;
    saveState();
  }
  render();
});

function deleteSelection() {
  if (!selected) return;
  pushHistory();
  if (selected.type === "room") {
    state.rooms = state.rooms.filter((item) => item.id !== selected.id);
  } else if (selected.type === "room-wall") {
    const room = state.rooms.find((item) => item.id === selected.id);
    if (room && !room.hiddenSides.includes(selected.side)) room.hiddenSides.push(selected.side);
  } else if (selected.type === "wall") {
    state.walls = state.walls.filter((item) => item.id !== selected.id);
  }
  selected = null;
  render();
  saveState();
}

selectionForm.addEventListener("change", (event) => {
  if (selected?.type !== "room") return;
  const room = state.rooms.find((item) => item.id === selected.id);
  if (!room) return;
  const field = event.target.name;
  try {
    let parsedLength = null;
    if (field === "width" || field === "height") parsedLength = parseArchitecturalLength(event.target.value);
    pushHistory();
    if (field === "name") room.name = event.target.value.trim() || "Room";
    if (field === "width") room.width = Math.max(MIN_ROOM_MM, lengthUmToLegacyMm(parsedLength));
    if (field === "height") room.height = Math.max(MIN_ROOM_MM, lengthUmToLegacyMm(parsedLength));
    if (field === "included") room.included = event.target.checked;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Invalid dimension");
  }
  render();
  saveState();
});
selectionForm.addEventListener("click", (event) => {
  if (event.target.closest("[data-delete]")) deleteSelection();
});

document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
document.querySelector("#delete-selection").addEventListener("click", deleteSelection);
document.querySelector("#undo").addEventListener("click", undo);
document.querySelector("#redo").addEventListener("click", redo);

document.querySelector("#show-reference").addEventListener("change", (event) => {
  state.reference.show = event.target.checked; render(); saveState();
});
document.querySelector("#reference-opacity").addEventListener("input", (event) => {
  state.reference.opacity = Number(event.target.value) / 100; render(); saveState();
});
document.querySelector("#snap-grid").addEventListener("change", (event) => {
  state.snap = event.target.checked; render(); saveState();
});
document.querySelector("#show-labels").addEventListener("change", (event) => {
  state.showLabels = event.target.checked; render(); saveState();
});

[["site-width", "width"], ["site-depth", "depth"]].forEach(([id, key]) => {
  document.querySelector(`#${id}`).addEventListener("change", (event) => {
    try {
      const parsed = parseArchitecturalLength(event.target.value);
      const candidateState = clone(state);
      candidateState.site[key] = lengthUmToLegacyMm(parsed);
      const candidateProject = updateProjectFromLegacyEditorState(project, candidateState);
      pushHistory();
      state = candidateState;
      project = candidateProject;
      render(); saveState();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid site dimension");
      render();
    }
  });
});

[
  ["left-target", "leftUm"],
  ["right-target", "rightUm"],
  ["rear-min-target", "rearMinUm"],
  ["rear-preferred-target", "rearPreferredUm"],
].forEach(([id, key]) => {
  document.querySelector(`#${id}`).addEventListener("change", (event) => {
    try {
      const parsed = parseArchitecturalLength(event.target.value, { allowZero: true });
      const nextSetbacks = { ...project.site.designSetbacks, [key]: parsed };
      const candidate = clone(project);
      candidate.site.designSetbacks = nextSetbacks;
      validateProjectV2(candidate);
      pushHistory();
      project = candidate;
      render(); saveState();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid design target");
      render();
    }
  });
});
document.querySelector("#common-area").addEventListener("change", (event) => {
  pushHistory();
  state.commonAreaMm2 = Math.max(0, Number(event.target.value) * FT2_TO_MM2);
  render(); saveState();
});

function setZoom(next) {
  const viewport = document.querySelector("#canvas-viewport");
  const horizontalCenter = (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(1, viewport.scrollWidth);
  const verticalCenter = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(1, viewport.scrollHeight);
  zoom = Math.min(2.5, Math.max(1, next));
  svg.style.width = `${zoom * 100}%`;
  svg.style.height = `${zoom * 100}%`;
  document.querySelector("#zoom-output").textContent = `${Math.round(zoom * 100)}%`;
  window.requestAnimationFrame(() => {
    viewport.scrollLeft = horizontalCenter * viewport.scrollWidth - viewport.clientWidth / 2;
    viewport.scrollTop = verticalCenter * viewport.scrollHeight - viewport.clientHeight / 2;
  });
}
document.querySelector("#zoom-in").addEventListener("click", () => setZoom(zoom + 0.15));
document.querySelector("#zoom-out").addEventListener("click", () => setZoom(zoom - 0.15));
document.querySelector("#fit-plan").addEventListener("click", () => {
  setZoom(1);
  const viewport = document.querySelector("#canvas-viewport");
  viewport.scrollTo({ left: 0, top: 0 });
});

document.querySelector("#reset-plan").addEventListener("click", () => {
  if (!window.confirm("Reset all rooms, walls, and coverage inputs to the OPTION-3 starting plan?")) return;
  pushHistory();
  project = createOption3ProjectV2();
  state = projectToLegacyEditorState(project);
  selected = null;
  render(); saveState(); showToast("Plan reset");
});

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

document.querySelector("#export-json").addEventListener("click", () => {
  try {
    project = updateProjectFromLegacyEditorState(project, state);
    download("option-3-plan66-v2.json", "application/json", serializeProject(project));
    showToast("Validated ProjectV2 file downloaded");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Project validation failed");
  }
});

document.querySelector("#export-svg").addEventListener("click", () => {
  const copy = svg.cloneNode(true);
  copy.querySelector("#interaction-layer")?.remove();
  copy.querySelector("#grid-layer")?.remove();
  copy.setAttribute("viewBox", `0 0 ${state.site.width} ${state.site.depth}`);
  copy.setAttribute("width", `${state.site.width / 25.4}in`);
  copy.setAttribute("height", `${state.site.depth / 25.4}in`);
  download("option-3-plan66.svg", "image/svg+xml", new XMLSerializer().serializeToString(copy));
  showToast("SVG downloaded");
});

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

window.addEventListener("keydown", (event) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (event.key.toLowerCase() === "v") setTool("select");
  if (event.key.toLowerCase() === "r") setTool("room");
  if (event.key.toLowerCase() === "w") setTool("wall");
  if (event.key === "Delete" || event.key === "Backspace") deleteSelection();
  if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
  if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
});

function registerAgentTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const register = (tool) => {
    try {
      void Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {
      // Browsers without a complete WebMCP implementation keep normal UI behavior.
    }
  };

  register({
    name: "read_plan_summary",
    title: "Read plan summary",
    description: "Read the exact ProjectV2 site limits and the clearly separated legacy prototype estimate.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      const values = coverageValues();
      return {
        schemaVersion: project.schemaVersion,
        plotWidth: formatArchitecturalLength(project.site.boundary.widthUm),
        plotDepth: formatArchitecturalLength(project.site.boundary.depthUm),
        coverageLimitPercent: state.site.coverageLimit * 100,
        plotAreaSqFt: areaToSquareFeet(values.plotAreaUm2),
        maximumCoverageSqFt: areaToSquareFeet(values.maximumCoverageUm2),
        legacyPrototypeDesignedCoverageSqFt: values.designed / FT2_TO_MM2,
        legacyPrototypeCoveragePercent: values.percent,
        legacyPrototypeRemainingSqFt: values.remaining / FT2_TO_MM2,
        authoritativeFootprintCoverageStatus: project.building.coverageStatus,
        roomCount: state.rooms.length,
        addedWallCount: state.walls.length,
      };
    },
  });

  register({
    name: "add_plan_room",
    title: "Add room",
    description: "Add one rectangular room to the visible plan using feet for coordinates and dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        xFt: { type: "number", minimum: 0 },
        yFt: { type: "number", minimum: 0 },
        widthFt: { type: "number", minimum: 2.5 },
        depthFt: { type: "number", minimum: 2.5 },
        countsTowardCoverage: { type: "boolean" },
      },
      required: ["name", "xFt", "yFt", "widthFt", "depthFt"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input.name !== "string" || !Number.isFinite(input.widthFt) || !Number.isFinite(input.depthFt)) {
        throw new Error("Valid room name, widthFt, and depthFt are required.");
      }
      pushHistory();
      const room = {
        id: `room-${Date.now()}`,
        name: input.name.trim(),
        x: Number(input.xFt) * MM_PER_FT,
        y: Number(input.yFt) * MM_PER_FT,
        width: Math.max(MIN_ROOM_MM, Number(input.widthFt) * MM_PER_FT),
        height: Math.max(MIN_ROOM_MM, Number(input.depthFt) * MM_PER_FT),
        included: input.countsTowardCoverage !== false,
        hiddenSides: [],
      };
      state.rooms.push(room);
      selected = { type: "room", id: room.id };
      render();
      saveState();
      return { id: room.id, coveragePercent: coverageValues().percent };
    },
  });

  register({
    name: "set_plan_coverage_inputs",
    title: "Set coverage inputs",
    description: "Update exact plot dimensions from compatibility decimal feet or the legacy wall/common estimate. The supplied 66 percent limit cannot be changed.",
    inputSchema: {
      type: "object",
      properties: {
        plotWidthFt: { type: "number", minimum: 1 },
        plotDepthFt: { type: "number", minimum: 1 },
        wallCommonAreaSqFt: { type: "number", minimum: 0 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || !Object.keys(input).length) throw new Error("Provide at least one coverage input.");
      const candidateState = clone(state);
      let width = null;
      let depth = null;
      if (Number.isFinite(input.plotWidthFt)) {
        width = decimalFeetToLength(input.plotWidthFt);
        candidateState.site.width = lengthUmToLegacyMm(width);
      }
      if (Number.isFinite(input.plotDepthFt)) {
        depth = decimalFeetToLength(input.plotDepthFt);
        candidateState.site.depth = lengthUmToLegacyMm(depth);
      }
      if (Number.isFinite(input.wallCommonAreaSqFt)) {
        candidateState.commonAreaMm2 = input.wallCommonAreaSqFt * FT2_TO_MM2;
      }
      const candidateProject = updateProjectFromLegacyEditorState(project, candidateState);
      pushHistory();
      project = candidateProject;
      state = candidateState;
      render();
      saveState();
      const values = coverageValues();
      return { coverageLimitPercent: 66, coveragePercent: values.percent, remainingSqFt: values.remaining / FT2_TO_MM2 };
    },
  });
}

render();
setTool("select");
registerAgentTools();
if (projectLoadError) {
  document.querySelector("#save-status").textContent = "Saved project rejected";
  showToast(`Saved project was not loaded: ${projectLoadError}`);
}
