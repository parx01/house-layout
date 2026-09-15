import {
  areaToSquareFeet,
  calculateOption3CanvasViewBox,
  createOption3ProjectV2,
  createTopologySvgRenderModel,
  decimalFeetToLength,
  formatArchitecturalLength,
  formatSquareFeet,
  foundationSummary,
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
const FT2_TO_MM2 = 92_903.04;
let project = createOption3ProjectV2();
let projectLoadError = "";
let state = loadState();
let selected = null;
let activeTool = "select";
let history = [];
let future = [];
let zoom = 1;
let toastTimer;
let showLegacyComparison = false;
let topologyRenderModel = null;

const svg = document.querySelector("#plan-svg");
const faceLayer = document.querySelector("#face-layer");
const legacyComparisonLayer = document.querySelector("#legacy-comparison-layer");
const topologyWallLayer = document.querySelector("#topology-wall-layer");
const junctionLayer = document.querySelector("#junction-layer");
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

function renderTopologyFaces(model) {
  faceLayer.replaceChildren();
  if (!model) {
    const message = el("text", {
      x: state.site.width / 2,
      y: state.site.depth / 2,
      class: "topology-unavailable",
    });
    message.textContent = "Canonical topology unavailable · reset to Option-3 baseline";
    faceLayer.append(message);
    return;
  }
  model.faces.forEach((face) => {
    const polygon = el("polygon", {
      points: face.pointsAttribute,
      class: `topology-face ${selected?.type === "topology-face" && selected.id === face.id ? "selected" : ""}`,
      "data-action": "select-topology-face",
      "data-id": face.id,
      tabindex: 0,
      role: "button",
      "aria-label": `Derived face, ${face.areaLabel}`,
    });
    const title = el("title");
    title.textContent = `Derived face · ${face.areaLabel}`;
    polygon.append(title);
    faceLayer.append(polygon);
    if (state.showLabels) {
      const label = el("text", { x: face.labelX, y: face.labelY, class: "topology-face-area" });
      label.textContent = face.areaLabel;
      faceLayer.append(label);
    }
  });
}

function renderLegacyComparison() {
  legacyComparisonLayer.replaceChildren();
  if (!showLegacyComparison) return;
  state.rooms.forEach((room) => {
    legacyComparisonLayer.append(el("rect", {
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
      class: "legacy-room-comparison",
      "data-legacy-room-id": room.id,
    }));
  });
}

function renderTopologyWalls(model) {
  topologyWallLayer.replaceChildren();
  if (!model) return;
  model.walls.forEach((wall) => {
    const group = el("g", {
      class: `topology-wall-group ${selected?.type === "topology-wall" && selected.id === wall.id ? "selected" : ""}`,
      "data-wall-id": wall.id,
    });
    group.append(el("line", {
      x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
      class: "topology-wall-band",
      "stroke-width": wall.strokeWidth,
    }));
    group.append(el("line", {
      x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
      class: "topology-wall-centre",
    }));
    const hit = el("line", {
      x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
      class: "topology-wall-hit topology-hit-target",
      "data-action": "select-topology-wall",
      "data-id": wall.id,
      tabindex: 0,
      role: "button",
      "aria-label": `Physical wall, ${wall.lengthLabel} long, ${wall.thicknessLabel} thick`,
    });
    const title = el("title");
    title.textContent = `Physical wall · ${wall.lengthLabel} long · ${wall.thicknessLabel} thick`;
    hit.append(title);
    group.append(hit);
    topologyWallLayer.append(group);
  });
}

function renderTopologyJunctions(model) {
  junctionLayer.replaceChildren();
  if (!model) return;
  model.junctions.forEach((junction) => {
    const group = el("g", {
      class: `topology-junction-group ${selected?.type === "topology-junction" && selected.id === junction.id ? "selected" : ""}`,
      "data-node-id": junction.id,
    });
    group.append(el("circle", { cx: junction.x, cy: junction.y, r: 78, class: "topology-junction" }));
    const hit = el("circle", {
      cx: junction.x,
      cy: junction.y,
      r: 190,
      class: "topology-junction-hit topology-hit-target",
      "data-action": "select-topology-junction",
      "data-id": junction.id,
      tabindex: 0,
      role: "button",
      "aria-label": `Canonical junction, degree ${junction.degree}`,
    });
    const title = el("title");
    title.textContent = `Canonical junction · ${junction.degree} connected walls`;
    hit.append(title);
    group.append(hit);
    junctionLayer.append(group);
  });
}

function renderHandles() {
  interactionLayer.replaceChildren();
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
  if (selected.type === "topology-face") {
    const face = topologyRenderModel?.faces.find((item) => item.id === selected.id);
    if (!face) { selected = null; return renderSelection(); }
    selectionForm.innerHTML = `
      <div><div class="selection-name">Derived face</div><div class="selection-type">Read-only · no room semantics</div></div>
      <div class="selection-field">Area <span>${escapeHtml(face.areaLabel)}</span></div>
      <div class="selection-field">Boundary <span>${face.boundary.length} wall segments</span></div>
      <p class="field-note">${escapeHtml(face.id)}<br>Polygon and area are derived from canonical directed wall references.</p>`;
  } else if (selected.type === "topology-wall") {
    const wall = topologyRenderModel?.walls.find((item) => item.id === selected.id);
    if (!wall) { selected = null; return renderSelection(); }
    selectionForm.innerHTML = `
      <div><div class="selection-name">Physical wall</div><div class="selection-type">Canonical centre-line · read-only</div></div>
      <div class="selection-field">Length <span>${escapeHtml(wall.lengthLabel)}</span></div>
      <div class="selection-field">Thickness <span>${escapeHtml(wall.thicknessLabel)}</span></div>
      <p class="field-note">${escapeHtml(wall.id)}<br>${escapeHtml(wall.startNodeId)} → ${escapeHtml(wall.endNodeId)}</p>`;
  } else {
    const junction = topologyRenderModel?.junctions.find((item) => item.id === selected.id);
    if (!junction) { selected = null; return renderSelection(); }
    selectionForm.innerHTML = `
      <div><div class="selection-name">Canonical junction</div><div class="selection-type">Shared node · read-only</div></div>
      <div class="selection-field">Connected walls <span>${junction.degree}</span></div>
      <div class="selection-field">X from origin <span>${escapeHtml(junction.xLabel)}</span></div>
      <div class="selection-field">Y from origin <span>${escapeHtml(junction.yLabel)}</span></div>
      <p class="field-note">${escapeHtml(junction.id)}</p>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  topologyRenderModel = project.topology?.status === "active"
    ? createTopologySvgRenderModel(project.topology)
    : null;
  renderSite();
  renderTopologyFaces(topologyRenderModel);
  renderLegacyComparison();
  renderTopologyWalls(topologyRenderModel);
  renderTopologyJunctions(topologyRenderModel);
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
  document.querySelector("#show-legacy-comparison").checked = showLegacyComparison;
  svg.dataset.geometrySource = topologyRenderModel ? "canonical-topology" : "topology-deferred";
  svg.dataset.faceCount = String(topologyRenderModel?.faces.length ?? 0);
  svg.dataset.wallCount = String(topologyRenderModel?.walls.length ?? 0);
  svg.dataset.junctionCount = String(topologyRenderModel?.junctions.length ?? 0);
  svg.dataset.tool = activeTool;
  updateUndoButtons();
}

function setTool(tool) {
  if (tool !== "select") {
    showToast("Topology geometry is read-only in A2.6");
    return;
  }
  activeTool = "select";
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.querySelector("#canvas-title").textContent = "Inspect canonical topology";
  document.querySelector("#canvas-hint").textContent = "Select faces, physical walls, and junctions · read-only";
  renderHandles();
}

function startDrag(event, target) {
  const action = target.dataset.action;
  if (action === "select-topology-face") selected = { type: "topology-face", id: target.dataset.id };
  else if (action === "select-topology-wall") selected = { type: "topology-wall", id: target.dataset.id };
  else if (action === "select-topology-junction") selected = { type: "topology-junction", id: target.dataset.id };
  else return;
  event.preventDefault();
  render();
}

svg.addEventListener("pointerdown", (event) => {
  const target = event.target.closest("[data-action]");
  if (target) {
    startDrag(event, target);
    return;
  }
  selected = null;
  render();
});

svg.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest?.("[data-action]");
  if (target) startDrag(event, target);
});

function deleteSelection() {
  if (selected) showToast("Topology geometry is read-only in A2.6");
}

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
document.querySelector("#show-legacy-comparison").addEventListener("change", (event) => {
  showLegacyComparison = event.target.checked;
  render();
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
  if (!window.confirm("Reset to the canonical OPTION-3 baseline project?")) return;
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
  copy.querySelector("#legacy-comparison-layer")?.remove();
  copy.querySelectorAll(".topology-hit-target").forEach((target) => target.remove());
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
