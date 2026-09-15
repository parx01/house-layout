import { OPTION_3_SITE_DEPTH_UM, OPTION_3_SITE_WIDTH_UM } from "../core/site.js";
import { createOption3TopologyV2 } from "../project/option3-topology.js";
const REFERENCE_HREF = "../dist/assets/option-3-reference.png";
/** Dev-only diagnostic; it is not imported by the production editor UI. */
export function createOption3TopologyOverlaySvg() {
    const topology = createOption3TopologyV2();
    const walls = Object.values(topology.walls).sort((left, right) => left.id.localeCompare(right.id));
    const nodes = Object.values(topology.nodes).sort((left, right) => left.id.localeCompare(right.id));
    const wallBands = walls.map((wall) => {
        const start = topology.nodes[wall.startNodeId];
        const end = topology.nodes[wall.endNodeId];
        return `    <line class="wall-band" data-wall-id="${wall.id}" x1="${start.xUm}" y1="${start.yUm}" x2="${end.xUm}" y2="${end.yUm}" stroke-width="${wall.thicknessUm}" />`;
    });
    const centreLines = walls.map((wall) => {
        const start = topology.nodes[wall.startNodeId];
        const end = topology.nodes[wall.endNodeId];
        return `    <line class="wall-centre" data-wall-id="${wall.id}" x1="${start.xUm}" y1="${start.yUm}" x2="${end.xUm}" y2="${end.yUm}" />`;
    });
    const nodeMarks = nodes.map((node) => `    <circle class="topology-node" data-node-id="${node.id}" cx="${node.xUm}" cy="${node.yUm}" r="65000" />`);
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OPTION_3_SITE_WIDTH_UM} ${OPTION_3_SITE_DEPTH_UM}" role="img" aria-labelledby="title description">`,
        "  <title id=\"title\">Option-3 canonical topology over fixed reference</title>",
        `  <desc id="description">Development diagnostic showing ${nodes.length} canonical nodes and ${walls.length} wall segments over the preserved Option-3 reference.</desc>`,
        "  <rect width=\"100%\" height=\"100%\" fill=\"#ffffff\" />",
        `  <image href="${REFERENCE_HREF}" width="${OPTION_3_SITE_WIDTH_UM}" height="${OPTION_3_SITE_DEPTH_UM}" preserveAspectRatio="none" opacity="0.68" />`,
        "  <g fill=\"none\" stroke=\"#00a7e1\" stroke-linecap=\"square\" opacity=\"0.28\">",
        ...wallBands,
        "  </g>",
        "  <g fill=\"none\" stroke=\"#e40046\" stroke-width=\"32000\" stroke-linecap=\"round\">",
        ...centreLines,
        "  </g>",
        "  <g fill=\"#ffe100\" stroke=\"#171717\" stroke-width=\"18000\">",
        ...nodeMarks,
        "  </g>",
        "</svg>",
        "",
    ].join("\n");
}
//# sourceMappingURL=option3-topology-overlay.js.map