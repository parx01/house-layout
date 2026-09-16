import { OPTION_3_SITE_DEPTH_UM, OPTION_3_SITE_WIDTH_UM } from "../core/site.js";
import { createOption3SemanticSpaceMappingRows } from "../project/option3-semantic-spaces.js";
import { createOption3TopologyV2 } from "../project/option3-topology.js";
import type { SpaceCategory } from "../spaces/semantic-model.js";
import { createTopologySvgRenderModel } from "../ui/topology-renderer.js";

const REPOSITORY_REFERENCE_HREF = "../dist/assets/option-3-reference.png";
const UM_PER_DIAGNOSTIC_UNIT = 1_000;
const CATEGORY_COLOURS: Readonly<Record<SpaceCategory, string>> = {
  room: "#5aa9e6",
  circulation: "#f4a261",
  service: "#65c18c",
  storage: "#b49ad9",
  other: "#e9c46a",
};

/** Dev-only A3.2 artifact; it is not imported by the production editor UI. */
export function createOption3SemanticOverlaySvg(referenceHref = REPOSITORY_REFERENCE_HREF): string {
  const topology = createOption3TopologyV2();
  const renderModel = createTopologySvgRenderModel(topology);
  const rows = createOption3SemanticSpaceMappingRows();
  const rowByFaceId = new Map(rows.map((row) => [row.faceId, row]));

  const facePolygons = renderModel.faces.map((face) => {
    const row = rowByFaceId.get(face.id);
    if (!row) throw new Error(`Option-3 diagnostic has no semantic binding for ${face.id}.`);
    const points = face.points.map((point) => `${point.x},${point.y}`).join(" ");
    return `    <polygon class="semantic-face" data-space-id="${row.id}" data-face-id="${row.faceId}" points="${points}" fill="${CATEGORY_COLOURS[row.category]}" />`;
  });

  const wallBands = renderModel.walls.map((wall) =>
    `    <line class="wall-band" data-wall-id="${wall.id}" x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" stroke-width="${wall.strokeWidth}" />`,
  );
  const centreLines = renderModel.walls.map((wall) =>
    `    <line class="wall-centre" data-wall-id="${wall.id}" x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" />`,
  );

  const labels = rows.map((row) => {
    const face = renderModel.faces.find((candidate) => candidate.id === row.faceId);
    if (!face) throw new Error(`Option-3 diagnostic cannot place semantic label for ${row.faceId}.`);
    const x = row.id === "s-lobby-dining-puja" ? 9_100 : face.labelX;
    const y = face.labelY;
    const width = Math.min(4_300, Math.max(1_700, row.name.length * 120));
    return [
      `    <g class="semantic-label" data-space-id="${row.id}" data-face-id="${row.faceId}" transform="translate(${x} ${y})">`,
      `      <rect x="${-width / 2}" y="-380" width="${width}" height="760" rx="70" fill="#ffffff" fill-opacity="0.92" stroke="${CATEGORY_COLOURS[row.category]}" stroke-width="18" />`,
      `      <text text-anchor="middle" font-family="Arial, sans-serif" fill="#17202a">`,
      `        <tspan class="semantic-name" x="0" y="-145" font-size="210" font-weight="700">${escapeXml(row.name)}</tspan>`,
      `        <tspan class="semantic-id" x="0" y="90" font-size="145">${row.id}</tspan>`,
      `        <tspan class="face-id" x="0" y="280" font-size="100">${row.faceId} · ${row.areaLabel}</tspan>`,
      "      </text>",
      "    </g>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OPTION_3_SITE_WIDTH_UM / UM_PER_DIAGNOSTIC_UNIT} ${OPTION_3_SITE_DEPTH_UM / UM_PER_DIAGNOSTIC_UNIT}" role="img" aria-labelledby="title description">`,
    "  <title id=\"title\">Option-3 A3.2 semantic spaces over fixed reference</title>",
    `  <desc id="description">Development diagnostic showing all ${rows.length} curated semantic SpaceId to derived FaceId bindings over the preserved Option-3 reference.</desc>`,
    "  <rect width=\"100%\" height=\"100%\" fill=\"#ffffff\" />",
    `  <image href="${escapeXml(referenceHref)}" width="${OPTION_3_SITE_WIDTH_UM / UM_PER_DIAGNOSTIC_UNIT}" height="${OPTION_3_SITE_DEPTH_UM / UM_PER_DIAGNOSTIC_UNIT}" preserveAspectRatio="none" opacity="0.55" />`,
    "  <g opacity=\"0.24\">",
    ...facePolygons,
    "  </g>",
    "  <g fill=\"none\" stroke=\"#00a7e1\" stroke-linecap=\"square\" opacity=\"0.24\">",
    ...wallBands,
    "  </g>",
    "  <g fill=\"none\" stroke=\"#d7263d\" stroke-width=\"30\" stroke-linecap=\"round\">",
    ...centreLines,
    "  </g>",
    "  <g>",
    ...labels,
    "  </g>",
    "  <g transform=\"translate(1600 20600)\" font-family=\"Arial, sans-serif\" fill=\"#17202a\">",
    "    <rect x=\"-150\" y=\"-420\" width=\"12100\" height=\"1020\" rx=\"100\" fill=\"#ffffff\" fill-opacity=\"0.93\" stroke=\"#17202a\" stroke-width=\"22\" />",
    "    <text x=\"100\" y=\"-150\" font-size=\"190\" font-weight=\"700\">A3.2 — 13 explicit semantic bindings</text>",
    "    <text x=\"100\" y=\"110\" font-size=\"130\">Puja is an open alcove inside the Lobby / Dining face; it is not a fourteenth face.</text>",
    "    <text x=\"100\" y=\"350\" font-size=\"120\">Areas are A2.4 centre-line polygon areas, not clear-room or coverage areas.</text>",
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

export function createOption3SemanticMappingMarkdown(): string {
  const rows = createOption3SemanticSpaceMappingRows();
  return [
    "# Option-3 A3.2 semantic-space mapping",
    "",
    "This is a deliberate mapping for the untouched curated Option-3 baseline. It is not a geometry- or size-based inference rule.",
    "",
    "The fixed reference contains 14 legacy labels but only 13 bounded topology faces. `PUJA RM.` is a three-sided alcove open to `LOBBY / DINING`, so those labels are represented by one persistent semantic space. No separate puja face is invented. This is the only source nuance; all 13 canonical faces are confidently identified.",
    "",
    "Derived areas below are A2.4 wall-centre-line polygon areas. They are not clear-room, coverage, or construction-certified areas.",
    "",
    "| SpaceId | Display name | Category | FaceId | Derived area | Boundary/location evidence |",
    "|---|---|---|---|---:|---|",
    ...rows.map((row) =>
      `| \`${row.id}\` | ${escapeMarkdownCell(row.name)} | \`${row.category}\` | \`${row.faceId}\` | ${row.areaLabel} | ${escapeMarkdownCell(row.locationEvidence)} Boundary (${row.boundaryWallIds.length} directed references): ${row.boundaryWallIds.map((id) => `\`${id}\``).join(", ")} |`,
    ),
    "",
    `Mapping total: **${rows.length} semantic spaces bound to ${rows.length} distinct derived faces.**`,
    "",
  ].join("\n");
}

/** A3.5 audit report. Classification is curated from the fixed reference, never inferred from category. */
export function createOption3SpecialSpaceClassificationMarkdown(): string {
  const rows = createOption3SemanticSpaceMappingRows();
  return [
    "# Option-3 A3.5 special-space classification",
    "",
    "These classifications are explicit semantic metadata for later architectural understanding. They do not calculate or decide A4 building coverage.",
    "",
    "The fixed Option-3 reference contains no bounded courtyard or open-to-sky void. The Lobby / Dining face and its open-sided Puja alcove are shown within the covered building plan, so no open-to-sky role is invented.",
    "",
    "| SpaceId | Name | Base category | Architectural role | Enclosure |",
    "|---|---|---|---|---|",
    ...rows.map((row) =>
      `| \`${row.id}\` | ${escapeMarkdownCell(row.name)} | \`${row.category}\` | \`${row.architecturalRole}\` | \`${row.enclosure}\` |`,
    ),
    "",
    `Classification total: **${rows.length} spaces; ${rows.filter((row) => row.enclosure === "openToSky").length} open-to-sky in Option-3.**`,
    "",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|");
}
