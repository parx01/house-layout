import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");

describe("A2.6 topology-native read-only UI contract", () => {
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
    expect(app).toContain("createTopologySvgRenderModel(project.topology)");
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

  it("provides selectable hit targets without exposing geometry edits", () => {
    expect(app).toContain('"data-action": "select-topology-face"');
    expect(app).toContain('"data-action": "select-topology-wall"');
    expect(app).toContain('"data-action": "select-topology-junction"');
    expect(css).toContain(".topology-wall-hit");
    expect(css).toContain(".topology-junction-hit");
    expect(html).toMatch(/data-tool="room"[^>]*disabled/);
    expect(html).toMatch(/data-tool="wall"[^>]*disabled/);
    expect(html).toMatch(/id="delete-selection"[^>]*disabled/);
    expect(app).not.toContain("state.rooms.push");
    expect(app).not.toContain("state.walls.push");
    expect(app).not.toContain("Date.now()");
  });

  it("shows only derived display information for selected topology entities", () => {
    expect(app).toContain("Derived face");
    expect(app).toContain("Physical wall");
    expect(app).toContain("Canonical junction");
    expect(app).toContain("no room semantics");
    expect(app).toContain("face.areaLabel");
    expect(app).toContain("wall.lengthLabel");
    expect(app).toContain("wall.thicknessLabel");
  });
});
