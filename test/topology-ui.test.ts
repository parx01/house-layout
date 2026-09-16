import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");

describe("B1/B2 topology-native selection and drag UI contract", () => {
  it("places topology faces beneath physical walls and canonical junctions", () => {
    const orderedLayerIds = [
      'id="grid-layer"',
      'id="site-layer"',
      'id="reference-layer"',
      'id="face-layer"',
      'id="legacy-comparison-layer"',
      'id="topology-wall-layer"',
      'id="junction-layer"',
      'id="interaction-layer"',
    ];
    const positions = orderedLayerIds.map((id) => html.indexOf(id));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("renders only canonical topology and derived face geometry by default", () => {
    expect(app).toContain("createTopologySvgRenderModel(renderProject.topology)");
    expect(app).toContain('svg.dataset.geometrySource = topologyRenderModel ? "canonical-topology" : "topology-deferred"');
    expect(app).toContain('class: "topology-wall-band"');
    expect(app).toContain('"stroke-width": wall.strokeWidth');
    expect(app).toContain('points: face.pointsAttribute');
    expect(html).not.toContain('id="room-layer"');
    expect(html).not.toContain('id="wall-layer"');
  });

  it("keeps the legacy rectangle comparison opt-in, non-interactive, and out of SVG exports", () => {
    expect(html).toMatch(/id="show-legacy-comparison" type="checkbox"\s*\/>/);
    expect(app).toContain("if (!showLegacyComparison) return;");
    expect(css).toMatch(/\.legacy-room-comparison\s*\{[^}]*pointer-events:\s*none;/s);
    expect(app).toContain('copy.querySelector("#legacy-comparison-layer")?.remove()');
  });

  it("routes pointer selection through canonical hit testing and B2 canonical dragging", () => {
    expect(app).toContain("createCanonicalHitTestModel");
    expect(app).toContain("hitTestCanonicalSelection");
    expect(app).toContain('"data-action": "select-canonical-space"');
    expect(app).toContain('"data-action": "select-canonical-wall"');
    expect(app).toContain('"data-action": "select-canonical-node"');
    expect(app).toContain('svg.addEventListener("pointermove"');
    expect(app).toContain('svg.addEventListener("pointerleave"');
    expect(app).toContain('svg.addEventListener("pointerup"');
    expect(app).toContain('svg.addEventListener("pointercancel"');
    expect(app).toContain("CanonicalDragController.begin");
    expect(app).toContain("exceedsDragActivationThreshold");
    expect(app).toContain("svg.setPointerCapture(event.pointerId)");
    expect(css).toContain(".topology-wall-hit");
    expect(css).toContain(".topology-junction-hit");
    expect(css).toContain(".topology-wall-group.hovered");
    expect(css).toContain(".topology-junction-group.hovered");
    expect(css).toContain(".topology-face.hovered");
    expect(html).toMatch(/data-tool="room"[^>]*disabled/);
    expect(html).toMatch(/data-tool="wall"[^>]*disabled/);
    expect(html).toMatch(/id="delete-selection"[^>]*disabled/);
    expect(app).not.toContain("state.rooms.push");
    expect(app).not.toContain("state.walls.push");
    expect(app).not.toContain("Date.now()");
  });

  it("keeps preview geometry separate and records one B0 before/after change", () => {
    expect(app).toContain("let previewProject = null");
    expect(app).toContain("return previewProject ?? project");
    expect(app).toContain("recordUndoableProjectChange(finished.result.undoableChange)");
    expect(app).not.toContain("pushHistory();\n    const result = activeDrag.controller.preview");
    expect(app).toContain('cancelActiveDrag("escape")');
    expect(app).toContain('cancelActiveDrag("pointerCancel")');
  });

  it("exposes valid, invalid, and footprint-affecting feedback without exporting it", () => {
    expect(css).toContain("#plan-svg.dragging-valid");
    expect(css).toContain("#plan-svg.dragging-invalid");
    expect(css).toContain("#plan-svg.footprint-affecting");
    expect(css).toContain(".drag-invalid-marker");
    expect(app).toContain('copy.classList.remove("dragging-valid", "dragging-invalid", "footprint-affecting")');
  });

  it("shows inspector-ready semantic and canonical display information", () => {
    expect(app).toContain("resolveCanonicalSelection");
    expect(app).toContain("Semantic space · read-only");
    expect(app).toContain("Physical wall");
    expect(app).toContain("Canonical junction");
    expect(app).toContain("resolved.architecturalRole");
    expect(app).toContain("resolved.classification");
    expect(app).toContain("resolved.connectedWallIds");
  });

  it("keeps transient hit targets and selection styling out of architectural SVG exports", () => {
    expect(app).toContain('copy.querySelectorAll(".topology-hit-target")');
    expect(app).toContain('copy.querySelectorAll(".hovered, .selected")');
    expect(app).toContain('target.classList.remove("hovered", "selected")');
  });
});
