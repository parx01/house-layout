import { deriveExteriorBoundary } from "../building/exterior-boundary.js";
import { validateProjectV2 } from "../project/validation.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { validateSemanticSpacesV2, } from "../spaces/semantic-model.js";
import { getConnectedWallIds, getWallEndNode, getWallLength, getWallOrientation, getWallStartNode, } from "../topology/model.js";
import { validateTopologyV2 } from "../topology/validation.js";
export const NODE_HIT_RADIUS_PX = 12;
export const WALL_MINIMUM_HIT_HALF_WIDTH_PX = 10;
export function createCanonicalSelectionState() {
    return selectionState(null, null);
}
export function setHoveredEntity(state, entity) {
    return selectionState(entity, state.selected);
}
export function clearHoveredEntity(state) {
    return setHoveredEntity(state, null);
}
export function selectCanonicalEntity(state, entity) {
    return selectionState(state.hovered, entity);
}
export function clearCanonicalSelection(state) {
    return selectionState(state.hovered, null);
}
export function createCanonicalHitTestModel(topologyValue, spacesValue) {
    const topology = validateTopologyV2(topologyValue, "selection.topology");
    const faces = extractBoundedFaces(topology).faces;
    const facesById = new Map(faces.map((face) => [face.id, face]));
    const spaces = spacesValue
        ? validateSemanticSpacesV2(spacesValue, topology, "selection.spaces").spaces
        : [];
    return Object.freeze({
        nodes: Object.values(topology.nodes)
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((node) => Object.freeze({ id: node.id, xUm: node.xUm, yUm: node.yUm })),
        walls: Object.values(topology.walls)
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((wall) => {
            const start = getWallStartNode(topology, wall.id);
            const end = getWallEndNode(topology, wall.id);
            return Object.freeze({
                id: wall.id,
                start: Object.freeze({ xUm: start.xUm, yUm: start.yUm }),
                end: Object.freeze({ xUm: end.xUm, yUm: end.yUm }),
                thicknessUm: wall.thicknessUm,
                orientation: getWallOrientation(topology, wall.id),
            });
        }),
        spaces: [...spaces]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((space) => Object.freeze({
            id: space.id,
            faceId: space.faceId,
            vertices: facesById.get(space.faceId).vertices,
        })),
    });
}
/** Deterministic node -> wall -> semantic-space hit testing in screen-normalized distance. */
export function hitTestCanonicalSelection(model, point, viewport) {
    assertFinitePoint(point);
    assertViewport(viewport);
    const nodes = model.nodes
        .map((node) => ({
        entity: { type: "node", id: node.id },
        distancePx: scaledDistance(point, node, viewport),
    }))
        .filter((candidate) => candidate.distancePx <= NODE_HIT_RADIUS_PX)
        .sort(compareHits);
    if (nodes[0])
        return nodes[0];
    const walls = model.walls
        .map((wall) => ({
        entity: { type: "wall", id: wall.id },
        distancePx: distanceToSegmentPx(point, wall.start, wall.end, viewport),
        hitHalfWidthPx: Math.max(WALL_MINIMUM_HIT_HALF_WIDTH_PX, wall.thicknessUm / 2 / perpendicularScale(wall, viewport)),
    }))
        .filter((candidate) => candidate.distancePx <= candidate.hitHalfWidthPx)
        .sort(compareHits);
    if (walls[0])
        return { entity: walls[0].entity, distancePx: walls[0].distancePx };
    const space = model.spaces.find((candidate) => pointInsideOrOnPolygon(point, candidate.vertices));
    return space ? { entity: { type: "space", id: space.id }, distancePx: 0 } : null;
}
export function reconcileCanonicalSelection(state, projectValue, remap = {}) {
    const project = validateProjectV2(projectValue);
    assertOneToOne(remap.spaces, "space");
    assertOneToOne(remap.walls, "wall");
    assertOneToOne(remap.nodes, "node");
    return selectionState(reconcileEntity(state.hovered, project, remap), reconcileEntity(state.selected, project, remap));
}
export function resolveCanonicalSelection(projectValue, entity) {
    if (!entity)
        return null;
    const project = validateProjectV2(projectValue);
    if (project.topology.status !== "active")
        return null;
    const topology = project.topology;
    if (entity.type === "space") {
        if (project.spaces.status !== "active")
            return null;
        const space = project.spaces.spaces.find((candidate) => candidate.id === entity.id);
        return space ? {
            type: "space",
            id: space.id,
            name: space.name,
            category: space.category,
            architecturalRole: space.architecturalRole,
            enclosure: space.enclosure,
            faceId: space.faceId,
        } : null;
    }
    if (entity.type === "wall") {
        const wall = topology.walls[entity.id];
        if (!wall)
            return null;
        const boundary = deriveExteriorBoundary(topology);
        return {
            type: "wall",
            id: wall.id,
            orientation: getWallOrientation(topology, wall.id),
            lengthUm: getWallLength(topology, wall.id),
            thicknessUm: wall.thicknessUm,
            startNodeId: wall.startNodeId,
            endNodeId: wall.endNodeId,
            classification: boundary.exteriorWallIds.includes(wall.id)
                ? "exterior"
                : boundary.internalSharedWallIds.includes(wall.id)
                    ? "internalShared"
                    : "nonFaceBoundary",
        };
    }
    const node = topology.nodes[entity.id];
    if (!node)
        return null;
    const connectedWallIds = getConnectedWallIds(topology, node.id).sort();
    return {
        type: "node",
        id: node.id,
        xUm: node.xUm,
        yUm: node.yUm,
        connectedWallIds,
        degree: connectedWallIds.length,
    };
}
function selectionState(hovered, selected) {
    return Object.freeze({ hovered: freezeEntity(hovered), selected: freezeEntity(selected) });
}
function freezeEntity(entity) {
    return entity ? Object.freeze({ ...entity }) : null;
}
function reconcileEntity(entity, project, remap) {
    if (!entity)
        return null;
    if (entityExists(project, entity))
        return entity;
    const mappedId = entity.type === "space"
        ? remap.spaces?.[entity.id]
        : entity.type === "wall"
            ? remap.walls?.[entity.id]
            : remap.nodes?.[entity.id];
    if (!mappedId)
        return null;
    const mapped = { type: entity.type, id: mappedId };
    return entityExists(project, mapped) ? mapped : null;
}
function entityExists(project, entity) {
    if (project.topology.status !== "active")
        return false;
    if (entity.type === "wall")
        return project.topology.walls[entity.id] !== undefined;
    if (entity.type === "node")
        return project.topology.nodes[entity.id] !== undefined;
    return project.spaces.status === "active" &&
        project.spaces.spaces.some((space) => space.id === entity.id);
}
function assertOneToOne(values, label) {
    if (!values)
        return;
    const targets = Object.values(values);
    if (new Set(targets).size !== targets.length) {
        throw new TypeError(`Canonical ${label} selection remap must be one-to-one.`);
    }
}
function assertFinitePoint(point) {
    if (!Number.isFinite(point.xUm) || !Number.isFinite(point.yUm)) {
        throw new TypeError("Selection hit point must contain finite micrometre coordinates.");
    }
}
function assertViewport(viewport) {
    if (!Number.isFinite(viewport.xUmPerCssPixel) || viewport.xUmPerCssPixel <= 0 ||
        !Number.isFinite(viewport.yUmPerCssPixel) || viewport.yUmPerCssPixel <= 0) {
        throw new TypeError("Selection viewport scale must contain positive finite micrometres per CSS pixel.");
    }
}
function scaledDistance(point, target, viewport) {
    return Math.hypot((target.xUm - point.xUm) / viewport.xUmPerCssPixel, (target.yUm - point.yUm) / viewport.yUmPerCssPixel);
}
function distanceToSegmentPx(point, start, end, viewport) {
    const startX = (start.xUm - point.xUm) / viewport.xUmPerCssPixel;
    const startY = (start.yUm - point.yUm) / viewport.yUmPerCssPixel;
    const endX = (end.xUm - point.xUm) / viewport.xUmPerCssPixel;
    const endY = (end.yUm - point.yUm) / viewport.yUmPerCssPixel;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const t = Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
    return Math.hypot(startX + t * deltaX, startY + t * deltaY);
}
function perpendicularScale(wall, viewport) {
    return wall.orientation === "horizontal" ? viewport.yUmPerCssPixel : viewport.xUmPerCssPixel;
}
function compareHits(left, right) {
    return left.distancePx - right.distancePx || left.entity.id.localeCompare(right.entity.id);
}
function pointInsideOrOnPolygon(point, vertices) {
    let inside = false;
    for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
        const start = vertices[previous];
        const end = vertices[index];
        if (pointOnSegment(point, start, end))
            return true;
        if ((end.yUm > point.yUm) === (start.yUm > point.yUm))
            continue;
        const intersectionX = start.xUm +
            ((point.yUm - start.yUm) * (end.xUm - start.xUm)) / (end.yUm - start.yUm);
        if (point.xUm < intersectionX)
            inside = !inside;
    }
    return inside;
}
function pointOnSegment(point, start, end) {
    const cross = (point.xUm - start.xUm) * (end.yUm - start.yUm) -
        (point.yUm - start.yUm) * (end.xUm - start.xUm);
    if (cross !== 0)
        return false;
    return point.xUm >= Math.min(start.xUm, end.xUm) &&
        point.xUm <= Math.max(start.xUm, end.xUm) &&
        point.yUm >= Math.min(start.yUm, end.yUm) &&
        point.yUm <= Math.max(start.yUm, end.yUm);
}
//# sourceMappingURL=selection.js.map