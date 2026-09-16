import {
  areaToSquareFeet,
  CanonicalDragController,
  calculateOption3CanvasViewBox,
  clientPointToModelUm,
  clearCanonicalSelection,
  clearHoveredEntity,
  createCanonicalHitTestModel,
  createCanonicalSelectionState,
  createOption3ProjectV2,
  createTopologySvgRenderModel,
  decimalFeetToLength,
  exceedsDragActivationThreshold,
  formatArchitecturalLength,
  formatSquareFeet,
  foundationSummary,
  hitTestCanonicalSelection,
  lengthUmToLegacyMm,
  OPTION_3_REFERENCE_DEPTH_UM,
  OPTION_3_REFERENCE_WIDTH_UM,
  parseArchitecturalLength,
  projectToLegacyEditorState,
  readProjectFromStorage,
  reconcileCanonicalSelection,
  resolveCanonicalSelection,
  selectCanonicalEntity,
  serializeProject,
  setHoveredEntity,
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
let selectionState = createCanonicalSelectionState();
let activeTool = "select";
let history = [];
let future = [];
let zoom = 1;
let toastTimer;
let showLegacyComparison = false;
let topologyRenderModel = null;
let selectionHitModel = null;
let previewProject = null;
let activeDrag = null;

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

function displayedProject() {
  return previewProject ?? project;
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  updateUndoButtons();
}

function recordUndoableProjectChange(change) {
  history.push({ state: clone(state), project: clone(change.beforeProject) });
  if (history.length > 60) history.shift();
  future = [];
  project = change.afterProject;
  updateUndoButtons();
}

function undo() {
  if (activeDrag) { cancelActiveDrag("explicit"); return; }
  if (!history.length) return;
  future.push(snapshot());
  ({ state, project } = history.pop());
  render();
  saveState();
}

function redo() {
  if (activeDrag) { cancelActiveDrag("explicit"); return; }
  if (!future.length) return;
  history.push(snapshot());
  ({ state, project } = future.pop());
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
  const siteSummary = foundationSummary(displayedProject());
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
  const renderProject = displayedProject();
  siteLayer.replaceChildren();
  const boundary = el("rect", {
    x: 0,
    y: 0,
    width: state.site.width,
    height: state.site.depth,
    class: "site-boundary",
  });
  siteLayer.append(boundary);

  const summary = foundationSummary(renderProject);
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
  road.textContent = renderProject.site.road.widthUm === null
    ? "ROAD · FRONT EDGE"
    : `ROAD · ${formatArchitecturalLength(renderProject.site.road.widthUm)} WIDE · PLAN NOTE`;
  siteLayer.append(road);
}

function sameEntity(left, right) {
  return left?.type === right?.type && left?.id === right?.id;
}

function selectionClass(entity) {
  return [
    sameEntity(selectionState.hovered, entity) ? "hovered" : "",
    sameEntity(selectionState.selected, entity) ? "selected" : "",
  ].filter(Boolean).join(" ");
}

function renderSelectionVisuals() {
  svg.querySelectorAll("[data-selection-type]").forEach((element) => {
    const entity = {
      type: element.dataset.selectionType,
      id: element.dataset.selectionId,
    };
    element.classList.toggle("hovered", sameEntity(selectionState.hovered, entity));
    element.classList.toggle("selected", sameEntity(selectionState.selected, entity));
  });
}

function renderTopologyFaces(model) {
  const renderProject = displayedProject();
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
    const space = renderProject.spaces?.status === "active"
      ? renderProject.spaces.spaces.find((candidate) => candidate.faceId === face.id)
      : null;
    const attributes = {
      points: face.pointsAttribute,
      class: `topology-face ${space ? selectionClass({ type: "space", id: space.id }) : ""}`,
      "aria-label": space ? `${space.name}, ${face.areaLabel}` : `Derived face, ${face.areaLabel}`,
    };
    if (space) Object.assign(attributes, {
      "data-action": "select-canonical-space",
      "data-selection-type": "space",
      "data-selection-id": space.id,
      tabindex: 0,
      role: "button",
    });
    const polygon = el("polygon", attributes);
    const title = el("title");
    title.textContent = space ? `${space.name} · ${face.areaLabel}` : `Derived face · ${face.areaLabel}`;
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
      class: `topology-wall-group ${selectionClass({ type: "wall", id: wall.id })}`,
      "data-wall-id": wall.id,
      "data-selection-type": "wall",
      "data-selection-id": wall.id,
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
      "data-action": "select-canonical-wall",
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
      class: `topology-junction-group ${selectionClass({ type: "node", id: junction.id })}`,
      "data-node-id": junction.id,
      "data-selection-type": "node",
      "data-selection-id": junction.id,
    });
    group.append(el("circle", { cx: junction.x, cy: junction.y, r: 78, class: "topology-junction" }));
    const hit = el("circle", {
      cx: junction.x,
      cy: junction.y,
      r: 190,
      class: "topology-junction-hit topology-hit-target",
      "data-action": "select-canonical-node",
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
  if (!activeDrag?.activated || !activeDrag.currentModelPoint || activeDrag.latestStatus === "valid") return;
  interactionLayer.append(el("circle", {
    cx: activeDrag.currentModelPoint.xUm / 1_000,
    cy: activeDrag.currentModelPoint.yUm / 1_000,
    r: 135,
    class: "drag-invalid-marker",
  }));
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
  const resolved = resolveCanonicalSelection(displayedProject(), selectionState.selected);
  if (!resolved) {
    selectionForm.hidden = true;
    emptySelection.hidden = false;
    selectionForm.replaceChildren();
    return;
  }
  emptySelection.hidden = true;
  selectionForm.hidden = false;
  if (resolved.type === "space") {
    const face = topologyRenderModel?.faces.find((item) => item.id === resolved.faceId);
    selectionForm.innerHTML = `
      <div><div class="selection-name">${escapeHtml(resolved.name)}</div><div class="selection-type">Semantic space · read-only</div></div>
      <div class="selection-field">Category <span>${escapeHtml(resolved.category)}</span></div>
      <div class="selection-field">Role <span>${escapeHtml(resolved.architecturalRole)}</span></div>
      <div class="selection-field">Enclosure <span>${escapeHtml(resolved.enclosure)}</span></div>
      ${face ? `<div class="selection-field">Centre-line area <span>${escapeHtml(face.areaLabel)}</span></div>` : ""}
      <p class="field-note">${escapeHtml(resolved.id)}<br>Current derived face: ${escapeHtml(resolved.faceId)}</p>`;
  } else if (resolved.type === "wall") {
    const classification = resolved.classification === "internalShared"
      ? "Internal / shared"
      : resolved.classification === "exterior"
        ? "Exterior"
        : "Non-face boundary";
    selectionForm.innerHTML = `
      <div><div class="selection-name">Physical wall</div><div class="selection-type">Canonical centre-line · drag perpendicular</div></div>
      <div class="selection-field">Classification <span>${classification}</span></div>
      <div class="selection-field">Orientation <span>${escapeHtml(resolved.orientation)}</span></div>
      <div class="selection-field">Length <span>${escapeHtml(formatArchitecturalLength(resolved.lengthUm))}</span></div>
      <div class="selection-field">Thickness <span>${escapeHtml(formatArchitecturalLength(resolved.thicknessUm))}</span></div>
      <p class="field-note">${escapeHtml(resolved.id)}<br>${escapeHtml(resolved.startNodeId)} → ${escapeHtml(resolved.endNodeId)}</p>`;
  } else {
    selectionForm.innerHTML = `
      <div><div class="selection-name">Canonical junction</div><div class="selection-type">Shared node · drag to adjust</div></div>
      <div class="selection-field">Connected walls <span>${resolved.degree}</span></div>
      <div class="selection-field">X from origin <span>${escapeHtml(formatArchitecturalLength(resolved.xUm))}</span></div>
      <div class="selection-field">Y from origin <span>${escapeHtml(formatArchitecturalLength(resolved.yUm))}</span></div>
      <p class="field-note">${escapeHtml(resolved.id)}<br>${resolved.connectedWallIds.map(escapeHtml).join(", ")}</p>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  const renderProject = displayedProject();
  selectionState = reconcileCanonicalSelection(selectionState, renderProject);
  topologyRenderModel = renderProject.topology?.status === "active"
    ? createTopologySvgRenderModel(renderProject.topology)
    : null;
  selectionHitModel = renderProject.topology?.status === "active"
    ? createCanonicalHitTestModel(
        renderProject.topology,
        renderProject.spaces?.status === "active" ? renderProject.spaces : undefined,
      )
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
    renderProject.site.boundary.widthUm,
    renderProject.site.boundary.depthUm,
  );
  svg.setAttribute("viewBox", [
    lengthUmToLegacyMm(viewBox.xUm),
    lengthUmToLegacyMm(viewBox.yUm),
    lengthUmToLegacyMm(viewBox.widthUm),
    lengthUmToLegacyMm(viewBox.depthUm),
  ].join(" "));
  document.querySelector("#site-width").value = formatArchitecturalLength(renderProject.site.boundary.widthUm);
  document.querySelector("#site-depth").value = formatArchitecturalLength(renderProject.site.boundary.depthUm);
  document.querySelector("#common-area").value = (state.commonAreaMm2 / FT2_TO_MM2).toFixed(2);
  document.querySelector("#left-target").value = formatArchitecturalLength(renderProject.site.designSetbacks.leftUm);
  document.querySelector("#right-target").value = formatArchitecturalLength(renderProject.site.designSetbacks.rightUm);
  document.querySelector("#rear-min-target").value = formatArchitecturalLength(renderProject.site.designSetbacks.rearMinUm);
  document.querySelector("#rear-preferred-target").value = formatArchitecturalLength(renderProject.site.designSetbacks.rearPreferredUm);
  document.querySelector("#front-target").value = renderProject.site.designSetbacks.frontMinUm === null
    ? "Flexible"
    : formatArchitecturalLength(renderProject.site.designSetbacks.frontMinUm);
  document.querySelector("#north-status").textContent = renderProject.site.orientation.northAngleDeg === null
    ? "Not established"
    : `${renderProject.site.orientation.northAngleDeg}° clockwise from plan up`;
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
  updateInteractionFeedback();
  updateUndoButtons();
}

function setTool(tool) {
  if (tool !== "select") {
    showToast("Wall and room creation remain deferred after B2");
    return;
  }
  activeTool = "select";
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.querySelector("#canvas-title").textContent = "Adjust canonical topology";
  document.querySelector("#canvas-hint").textContent = "Drag physical walls perpendicular to their axis or drag canonical junctions";
  renderHandles();
}

function entityFromSelectionTarget(target) {
  const type = target?.dataset.selectionType;
  const id = target?.dataset.selectionId;
  return id && ["space", "wall", "node"].includes(type) ? { type, id } : null;
}

function modelPointFromPointer(event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return clientPointToModelUm(
    { x: event.clientX, y: event.clientY },
    matrix.inverse(),
  );
}

function updateInteractionFeedback() {
  svg.classList.remove("dragging-valid", "dragging-invalid", "footprint-affecting");
  const hint = document.querySelector("#canvas-hint");
  if (!activeDrag?.activated) {
    hint.textContent = activeDrag
      ? "Move at least 3 px to begin editing · release to keep the current selection"
      : "Drag physical walls perpendicular to their axis or drag canonical junctions";
    return;
  }
  if (activeDrag.latestStatus === "valid") {
    svg.classList.add("dragging-valid");
    if (activeDrag.footprintChanged) svg.classList.add("footprint-affecting");
    hint.textContent = activeDrag.footprintChanged
      ? "Valid preview · this edit changes the physical building footprint"
      : "Valid preview · release to commit one undoable change";
    return;
  }
  svg.classList.add("dragging-invalid");
  hint.textContent = activeDrag.latestStatus === "remapRequired"
    ? `Cannot commit: semantic remapping is required · ${activeDrag.latestReason}`
    : `Invalid position · ${activeDrag.latestReason}`;
}

function releaseActivePointer(drag) {
  if (svg.hasPointerCapture?.(drag.pointerId)) svg.releasePointerCapture(drag.pointerId);
}

function cancelActiveDrag(reason) {
  const drag = activeDrag;
  if (!drag) return;
  if (drag.activated) drag.controller.cancel(reason);
  releaseActivePointer(drag);
  activeDrag = null;
  previewProject = null;
  selectionState = reconcileCanonicalSelection(selectionState, project);
  render();
  if (reason === "escape") showToast("Drag cancelled");
}

function finishActiveDrag() {
  const drag = activeDrag;
  if (!drag) return;
  releaseActivePointer(drag);
  if (!drag.activated) {
    activeDrag = null;
    previewProject = null;
    render();
    return;
  }
  const finished = drag.controller.commit();
  activeDrag = null;
  previewProject = null;
  if (finished.status === "committed") {
    recordUndoableProjectChange(finished.result.undoableChange);
    selectionState = reconcileCanonicalSelection(selectionState, project);
    render();
    saveState();
    showToast(finished.result.undoableChange.metadata.footprintChanged
      ? "Edit committed · physical footprint changed"
      : "Edit committed · footprint unchanged");
    return;
  }
  selectionState = reconcileCanonicalSelection(selectionState, project);
  render();
  showToast(finished.failure?.status === "remapRequired"
    ? "Edit cancelled · semantic remapping required"
    : `Edit cancelled${finished.failure?.reason ? ` · ${finished.failure.reason}` : ""}`);
}

function hitTestPointer(event) {
  if (!selectionHitModel) return null;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const inverse = matrix.inverse();
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  const origin = new DOMPoint(0, 0).matrixTransform(inverse);
  const xStep = new DOMPoint(1, 0).matrixTransform(inverse);
  const yStep = new DOMPoint(0, 1).matrixTransform(inverse);
  return hitTestCanonicalSelection(
    selectionHitModel,
    { xUm: point.x * 1_000, yUm: point.y * 1_000 },
    {
      xUmPerCssPixel: Math.max(Number.EPSILON, Math.abs(xStep.x - origin.x) * 1_000),
      yUmPerCssPixel: Math.max(Number.EPSILON, Math.abs(yStep.y - origin.y) * 1_000),
    },
  );
}

svg.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || activeDrag) return;
  const hit = hitTestPointer(event);
  selectionState = hit
    ? selectCanonicalEntity(selectionState, hit.entity)
    : clearCanonicalSelection(selectionState);
  event.preventDefault();
  renderSelectionVisuals();
  renderSelection();
  if (!hit || (hit.entity.type !== "wall" && hit.entity.type !== "node")) return;
  const startModelPoint = modelPointFromPointer(event);
  if (!startModelPoint) return;
  activeDrag = {
    pointerId: event.pointerId,
    entity: hit.entity,
    startClientPoint: { x: event.clientX, y: event.clientY },
    startModelPoint,
    currentModelPoint: startModelPoint,
    activated: false,
    controller: null,
    latestStatus: null,
    latestReason: "",
    footprintChanged: false,
  };
  svg.setPointerCapture(event.pointerId);
  updateInteractionFeedback();
});

svg.addEventListener("pointermove", (event) => {
  if (activeDrag?.pointerId === event.pointerId) {
    const modelPoint = modelPointFromPointer(event);
    if (!modelPoint) return;
    activeDrag.currentModelPoint = modelPoint;
    if (!activeDrag.activated) {
      if (!exceedsDragActivationThreshold(
        activeDrag.startClientPoint,
        { x: event.clientX, y: event.clientY },
      )) return;
      activeDrag.controller = CanonicalDragController.begin(
        project,
        activeDrag.entity,
        activeDrag.startModelPoint,
      );
      activeDrag.activated = true;
    }
    const result = activeDrag.controller.preview(modelPoint);
    previewProject = result.displayProject;
    activeDrag.latestStatus = result.preview.status;
    activeDrag.latestReason = result.preview.status === "valid" ? "" : result.preview.reason;
    activeDrag.footprintChanged = result.preview.status === "valid" && result.preview.metadata.footprintChanged;
    render();
    return;
  }
  const hit = hitTestPointer(event);
  const next = hit?.entity ?? null;
  if (sameEntity(selectionState.hovered, next)) return;
  selectionState = setHoveredEntity(selectionState, next);
  renderSelectionVisuals();
});

svg.addEventListener("pointerleave", () => {
  if (activeDrag) return;
  if (!selectionState.hovered) return;
  selectionState = clearHoveredEntity(selectionState);
  renderSelectionVisuals();
});

svg.addEventListener("pointerup", (event) => {
  if (activeDrag?.pointerId !== event.pointerId) return;
  event.preventDefault();
  finishActiveDrag();
});

svg.addEventListener("pointercancel", (event) => {
  if (activeDrag?.pointerId !== event.pointerId) return;
  cancelActiveDrag("pointerCancel");
});

svg.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const entity = entityFromSelectionTarget(event.target.closest?.("[data-selection-type]"));
  if (!entity) return;
  selectionState = selectCanonicalEntity(selectionState, entity);
  event.preventDefault();
  renderSelectionVisuals();
  renderSelection();
});

function deleteSelection() {
  if (selectionState.selected) showToast("Deleting canonical geometry is not available in B2");
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
  copy.querySelectorAll(".hovered, .selected").forEach((target) => {
    target.classList.remove("hovered", "selected");
  });
  copy.classList.remove("dragging-valid", "dragging-invalid", "footprint-affecting");
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
  if (event.key === "Escape" && activeDrag) {
    event.preventDefault();
    cancelActiveDrag("escape");
    return;
  }
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
