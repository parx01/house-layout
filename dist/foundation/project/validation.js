import { areaUm2, legacyMmToUm, lengthUm, umToLegacyMm } from "../core/units.js";
import { validateTopologyV2 } from "../topology/validation.js";
import { isOption3BaselineLegacyGeometry } from "./option3-baseline.js";
import { createOption3TopologyV2 } from "./option3-topology.js";
export class ProjectValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProjectValidationError";
    }
}
export class UnsupportedProjectVersionError extends Error {
    version;
    constructor(version) {
        super(`Unsupported project schema version: ${String(version)}.`);
        this.name = "UnsupportedProjectVersionError";
        this.version = version;
    }
}
function record(value, path) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        fail(`${path} must be an object.`);
    return value;
}
function exactKeys(value, required, optional, path) {
    for (const key of required)
        if (!(key in value))
            fail(`${path}.${key} is required.`);
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value))
        if (!allowed.has(key))
            fail(`${path}.${key} is not supported.`);
}
function finiteNumber(value, path, min = 0) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min)
        fail(`${path} must be a finite number >= ${min}.`);
    return value;
}
function safeInteger(value, path, min = 0) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min)
        fail(`${path} must be a safe integer >= ${min}.`);
    return value;
}
function stringValue(value, path) {
    if (typeof value !== "string" || value.length === 0)
        fail(`${path} must be a non-empty string.`);
    return value;
}
function booleanValue(value, path) {
    if (typeof value !== "boolean")
        fail(`${path} must be boolean.`);
    return value;
}
function literal(value, expected, path) {
    if (value !== expected)
        fail(`${path} must equal ${JSON.stringify(expected)}.`);
    return expected;
}
function edgeIndex(value, path) {
    if (value !== 0 && value !== 1 && value !== 2 && value !== 3)
        fail(`${path} must be 0, 1, 2, or 3.`);
    return value;
}
function nullableSafeLength(value, path) {
    return value === null ? null : lengthUm(safeInteger(value, path), path);
}
export function validateLegacyEditorStateV1(value, path = "project") {
    const root = record(value, path);
    exactKeys(root, ["site", "commonAreaMm2", "rooms", "walls", "reference", "snap", "showLabels"], ["version", "schemaVersion", "savedAt"], path);
    const site = record(root.site, `${path}.site`);
    exactKeys(site, ["width", "depth", "coverageLimit"], [], `${path}.site`);
    const width = finiteNumber(site.width, `${path}.site.width`, Number.EPSILON);
    const depth = finiteNumber(site.depth, `${path}.site.depth`, Number.EPSILON);
    const coverageLimit = finiteNumber(site.coverageLimit, `${path}.site.coverageLimit`, Number.EPSILON);
    if (coverageLimit > 1)
        fail(`${path}.site.coverageLimit cannot exceed 1.`);
    if (!Array.isArray(root.rooms))
        fail(`${path}.rooms must be an array.`);
    if (!Array.isArray(root.walls))
        fail(`${path}.walls must be an array.`);
    const rooms = root.rooms.map((roomValue, index) => validateLegacyRoom(roomValue, `${path}.rooms[${index}]`));
    const walls = root.walls.map((wallValue, index) => validateLegacyWall(wallValue, `${path}.walls[${index}]`));
    const reference = record(root.reference, `${path}.reference`);
    exactKeys(reference, ["show", "opacity"], [], `${path}.reference`);
    const opacity = finiteNumber(reference.opacity, `${path}.reference.opacity`);
    if (opacity > 1)
        fail(`${path}.reference.opacity cannot exceed 1.`);
    if (root.version !== undefined)
        literal(root.version, 1, `${path}.version`);
    if (root.schemaVersion !== undefined)
        literal(root.schemaVersion, 1, `${path}.schemaVersion`);
    if (root.savedAt !== undefined)
        stringValue(root.savedAt, `${path}.savedAt`);
    return {
        site: { width, depth, coverageLimit },
        commonAreaMm2: finiteNumber(root.commonAreaMm2, `${path}.commonAreaMm2`),
        rooms,
        walls,
        reference: { show: booleanValue(reference.show, `${path}.reference.show`), opacity },
        snap: booleanValue(root.snap, `${path}.snap`),
        showLabels: booleanValue(root.showLabels, `${path}.showLabels`),
    };
}
function validateLegacyRoom(value, path) {
    const room = record(value, path);
    exactKeys(room, ["id", "name", "x", "y", "width", "height", "included", "hiddenSides"], [], path);
    if (!Array.isArray(room.hiddenSides))
        fail(`${path}.hiddenSides must be an array.`);
    const hiddenSides = room.hiddenSides.map((side, index) => {
        if (side !== "top" && side !== "right" && side !== "bottom" && side !== "left")
            fail(`${path}.hiddenSides[${index}] is invalid.`);
        return side;
    });
    return {
        id: stringValue(room.id, `${path}.id`),
        name: stringValue(room.name, `${path}.name`),
        x: finiteNumber(room.x, `${path}.x`, Number.NEGATIVE_INFINITY),
        y: finiteNumber(room.y, `${path}.y`, Number.NEGATIVE_INFINITY),
        width: finiteNumber(room.width, `${path}.width`, Number.EPSILON),
        height: finiteNumber(room.height, `${path}.height`, Number.EPSILON),
        included: booleanValue(room.included, `${path}.included`),
        hiddenSides,
    };
}
function validateLegacyWall(value, path) {
    const wall = record(value, path);
    exactKeys(wall, ["id", "x1", "y1", "x2", "y2"], [], path);
    return {
        id: stringValue(wall.id, `${path}.id`),
        x1: finiteNumber(wall.x1, `${path}.x1`, Number.NEGATIVE_INFINITY),
        y1: finiteNumber(wall.y1, `${path}.y1`, Number.NEGATIVE_INFINITY),
        x2: finiteNumber(wall.x2, `${path}.x2`, Number.NEGATIVE_INFINITY),
        y2: finiteNumber(wall.y2, `${path}.y2`, Number.NEGATIVE_INFINITY),
    };
}
export function validateProjectV2(value) {
    const root = record(value, "project");
    exactKeys(root, [
        "schemaVersion",
        "schemaRevision",
        "projectId",
        "name",
        "units",
        "coordinateSystem",
        "site",
        "building",
        "topology",
        "spaces",
        "openings",
        "dimensions",
        "siteObjects",
        "legacyEditorState",
        "recovery",
    ], [], "project");
    literal(root.schemaVersion, 2, "project.schemaVersion");
    literal(root.schemaRevision, 3, "project.schemaRevision");
    literal(root.projectId, "option-3", "project.projectId");
    const name = stringValue(root.name, "project.name");
    literal(root.units, "um", "project.units");
    const coordinateSystem = record(root.coordinateSystem, "project.coordinateSystem");
    exactKeys(coordinateSystem, ["origin", "xAxis", "yAxis", "edgeIndexing", "geometryRotationPositive"], [], "project.coordinateSystem");
    literal(coordinateSystem.origin, "rearLeftPropertyCorner", "project.coordinateSystem.origin");
    literal(coordinateSystem.xAxis, "leftToRightWhenViewedWithFrontAtBottom", "project.coordinateSystem.xAxis");
    literal(coordinateSystem.yAxis, "rearToFront", "project.coordinateSystem.yAxis");
    literal(coordinateSystem.edgeIndexing, "clockwiseFromRear", "project.coordinateSystem.edgeIndexing");
    literal(coordinateSystem.geometryRotationPositive, "clockwiseInSvgView", "project.coordinateSystem.geometryRotationPositive");
    const site = validateSiteV2(root.site);
    const topology = validateProjectTopology(root.topology);
    const legacyEditorState = validateLegacyEditorStateV1(root.legacyEditorState, "project.legacyEditorState");
    const building = record(root.building, "project.building");
    exactKeys(building, ["status", "coverageStatus"], [], "project.building");
    const buildingStatus = topology.status === "active" ? "topologyActive" : "topologyDeferred";
    literal(building.status, buildingStatus, "project.building.status");
    literal(building.coverageStatus, "deferredToExteriorEnvelopeA4", "project.building.coverageStatus");
    const spaces = validateDeferredModel(root.spaces, "project.spaces", "A2");
    const openings = validateDeferredModel(root.openings, "project.openings", "postA2");
    const dimensions = validateDeferredModel(root.dimensions, "project.dimensions", "A2");
    const siteObjects = validateDeferredModel(root.siteObjects, "project.siteObjects", "postA2");
    const recovery = record(root.recovery, "project.recovery");
    exactKeys(recovery, ["fixture", "referenceImage", "referenceImageSha256"], [], "project.recovery");
    literal(recovery.fixture, "fixtures/option-3-v1.json", "project.recovery.fixture");
    literal(recovery.referenceImage, "dist/assets/option-3-reference.png", "project.recovery.referenceImage");
    const referenceImageSha256 = stringValue(recovery.referenceImageSha256, "project.recovery.referenceImageSha256");
    if (!/^[a-f0-9]{64}$/.test(referenceImageSha256))
        fail("project.recovery.referenceImageSha256 must be a lowercase SHA-256 value.");
    validateCrossModelTopology(site, topology, legacyEditorState);
    return {
        schemaVersion: 2,
        schemaRevision: 3,
        projectId: "option-3",
        name,
        units: "um",
        coordinateSystem: {
            origin: "rearLeftPropertyCorner",
            xAxis: "leftToRightWhenViewedWithFrontAtBottom",
            yAxis: "rearToFront",
            edgeIndexing: "clockwiseFromRear",
            geometryRotationPositive: "clockwiseInSvgView",
        },
        site,
        building: { status: buildingStatus, coverageStatus: "deferredToExteriorEnvelopeA4" },
        topology,
        spaces,
        openings,
        dimensions,
        siteObjects,
        legacyEditorState,
        recovery: {
            fixture: "fixtures/option-3-v1.json",
            referenceImage: "dist/assets/option-3-reference.png",
            referenceImageSha256,
        },
    };
}
function validateCrossModelTopology(site, topology, legacyEditorState) {
    if (topology.status !== "active")
        return;
    for (const node of Object.values(topology.nodes)) {
        if (node.xUm < 0 || node.yUm < 0 || node.xUm > site.boundary.widthUm || node.yUm > site.boundary.depthUm) {
            fail(`project.topology node ${node.id} lies outside the current site boundary.`);
        }
    }
    for (const wall of Object.values(topology.walls)) {
        const start = topology.nodes[wall.startNodeId];
        const end = topology.nodes[wall.endNodeId];
        const halfThicknessUm = wall.thicknessUm / 2;
        const bandOutside = start.yUm === end.yUm
            ? start.yUm - halfThicknessUm < 0 || start.yUm + halfThicknessUm > site.boundary.depthUm
            : start.xUm - halfThicknessUm < 0 || start.xUm + halfThicknessUm > site.boundary.widthUm;
        if (bandOutside)
            fail(`project.topology wall ${wall.id} thickness band lies outside the current site boundary.`);
    }
    if (legacyMmToUm(legacyEditorState.site.width) !== site.boundary.widthUm ||
        legacyMmToUm(legacyEditorState.site.depth) !== site.boundary.depthUm) {
        fail("project.topology cannot remain active when the legacy editor site dimensions disagree with the authoritative site.");
    }
    if (!isOption3BaselineLegacyGeometry(legacyEditorState)) {
        fail("project.topology cannot remain active after legacy editor geometry diverges from the curated Option-3 baseline.");
    }
    if (!topologyEquals(topology, createOption3TopologyV2())) {
        fail("project.topology is active but does not match the curated Option-3 topology compatible with the legacy baseline.");
    }
}
function topologyEquals(left, right) {
    const leftNodeIds = Object.keys(left.nodes).sort();
    const rightNodeIds = Object.keys(right.nodes).sort();
    if (!stringArraysEqual(leftNodeIds, rightNodeIds))
        return false;
    for (const id of leftNodeIds) {
        const leftNode = left.nodes[id];
        const rightNode = right.nodes[id];
        if (!rightNode || leftNode.id !== rightNode.id || leftNode.xUm !== rightNode.xUm || leftNode.yUm !== rightNode.yUm)
            return false;
    }
    const leftWallIds = Object.keys(left.walls).sort();
    const rightWallIds = Object.keys(right.walls).sort();
    if (!stringArraysEqual(leftWallIds, rightWallIds))
        return false;
    for (const id of leftWallIds) {
        const leftWall = left.walls[id];
        const rightWall = right.walls[id];
        if (!rightWall ||
            leftWall.id !== rightWall.id ||
            leftWall.startNodeId !== rightWall.startNodeId ||
            leftWall.endNodeId !== rightWall.endNodeId ||
            leftWall.thicknessUm !== rightWall.thicknessUm)
            return false;
    }
    return true;
}
function stringArraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function validateDeferredModel(value, path, targetStage) {
    const model = record(value, path);
    exactKeys(model, ["status", "targetStage", "modelVersion", "data"], [], path);
    literal(model.status, "deferred", `${path}.status`);
    literal(model.targetStage, targetStage, `${path}.targetStage`);
    if (model.modelVersion !== null)
        fail(`${path}.modelVersion must be null while deferred.`);
    if (model.data !== null)
        fail(`${path}.data must be null while deferred.`);
    return { status: "deferred", targetStage, modelVersion: null, data: null };
}
function validateProjectTopology(value) {
    const topology = record(value, "project.topology");
    if (topology.status === "deferred")
        return validateDeferredModel(value, "project.topology", "A2");
    return validateTopologyV2(value);
}
function validateSiteV2(value) {
    const site = record(value, "project.site");
    exactKeys(site, ["boundary", "frontEdgeIndex", "road", "orientation", "coverageRule", "designSetbacks"], [], "project.site");
    const boundary = record(site.boundary, "project.site.boundary");
    exactKeys(boundary, ["kind", "widthUm", "depthUm"], [], "project.site.boundary");
    literal(boundary.kind, "rectangle", "project.site.boundary.kind");
    const widthUm = lengthUm(safeInteger(boundary.widthUm, "project.site.boundary.widthUm", 1));
    const depthUm = lengthUm(safeInteger(boundary.depthUm, "project.site.boundary.depthUm", 1));
    areaUm2(widthUm * depthUm, "project.site.boundary area");
    const road = record(site.road, "project.site.road");
    exactKeys(road, ["edgeIndex", "label", "widthUm", "widthProvenance"], [], "project.site.road");
    const roadWidthUm = nullableSafeLength(road.widthUm, "project.site.road.widthUm");
    const roadWidthProvenance = validateRoadWidthProvenance(road.widthProvenance);
    if (roadWidthUm === null && roadWidthProvenance !== null) {
        fail("project.site.road.widthProvenance must be null when widthUm is null.");
    }
    if (roadWidthUm !== null && roadWidthProvenance === null) {
        fail("project.site.road.widthProvenance is required when widthUm is present.");
    }
    if (roadWidthProvenance?.kind === "referencePlanSuppliedUnverified" && roadWidthUm !== 12_000_000) {
        fail("project.site.road.widthUm must equal the 12,000,000 um value stated by OPTION-3.pdf.");
    }
    const orientation = record(site.orientation, "project.site.orientation");
    exactKeys(orientation, ["northAngleDeg", "angleReference", "positiveDirection"], [], "project.site.orientation");
    if (orientation.northAngleDeg !== null) {
        const north = finiteNumber(orientation.northAngleDeg, "project.site.orientation.northAngleDeg");
        if (north >= 360)
            fail("project.site.orientation.northAngleDeg must be less than 360.");
    }
    literal(orientation.angleReference, "screenUp", "project.site.orientation.angleReference");
    literal(orientation.positiveDirection, "clockwise", "project.site.orientation.positiveDirection");
    const coverageRule = record(site.coverageRule, "project.site.coverageRule");
    exactKeys(coverageRule, ["numerator", "denominator", "status"], [], "project.site.coverageRule");
    literal(coverageRule.numerator, 66, "project.site.coverageRule.numerator");
    literal(coverageRule.denominator, 100, "project.site.coverageRule.denominator");
    literal(coverageRule.status, "userSuppliedUnverified", "project.site.coverageRule.status");
    const setbacks = record(site.designSetbacks, "project.site.designSetbacks");
    exactKeys(setbacks, ["status", "leftUm", "rightUm", "rearMinUm", "rearPreferredUm", "frontMinUm"], [], "project.site.designSetbacks");
    literal(setbacks.status, "designTargetsNotRegulations", "project.site.designSetbacks.status");
    const rearMinUm = lengthUm(safeInteger(setbacks.rearMinUm, "project.site.designSetbacks.rearMinUm"));
    const rearPreferredUm = lengthUm(safeInteger(setbacks.rearPreferredUm, "project.site.designSetbacks.rearPreferredUm"));
    if (rearPreferredUm < rearMinUm)
        fail("project.site.designSetbacks.rearPreferredUm cannot be less than rearMinUm.");
    const leftUm = lengthUm(safeInteger(setbacks.leftUm, "project.site.designSetbacks.leftUm"));
    const rightUm = lengthUm(safeInteger(setbacks.rightUm, "project.site.designSetbacks.rightUm"));
    const frontMinUm = nullableSafeLength(setbacks.frontMinUm, "project.site.designSetbacks.frontMinUm");
    if (leftUm + rightUm >= widthUm)
        fail("project.site.designSetbacks side targets leave no buildable width.");
    if (rearMinUm + (frontMinUm ?? 0) >= depthUm)
        fail("project.site.designSetbacks front/rear targets leave no buildable depth.");
    if (rearPreferredUm + (frontMinUm ?? 0) >= depthUm)
        fail("project.site.designSetbacks preferred rear target leaves no buildable depth.");
    return {
        boundary: { kind: "rectangle", widthUm, depthUm },
        frontEdgeIndex: edgeIndex(site.frontEdgeIndex, "project.site.frontEdgeIndex"),
        road: {
            edgeIndex: edgeIndex(road.edgeIndex, "project.site.road.edgeIndex"),
            label: stringValue(road.label, "project.site.road.label"),
            widthUm: roadWidthUm,
            widthProvenance: roadWidthProvenance,
        },
        orientation: {
            northAngleDeg: orientation.northAngleDeg,
            angleReference: "screenUp",
            positiveDirection: "clockwise",
        },
        coverageRule: { numerator: 66, denominator: 100, status: "userSuppliedUnverified" },
        designSetbacks: {
            status: "designTargetsNotRegulations",
            leftUm,
            rightUm,
            rearMinUm,
            rearPreferredUm,
            frontMinUm,
        },
    };
}
function validateRoadWidthProvenance(value) {
    if (value === null)
        return null;
    const provenance = record(value, "project.site.road.widthProvenance");
    exactKeys(provenance, ["kind", "sourceDocument", "sourceLabel"], [], "project.site.road.widthProvenance");
    if (provenance.kind === "referencePlanSuppliedUnverified") {
        literal(provenance.sourceDocument, "OPTION-3.pdf", "project.site.road.widthProvenance.sourceDocument");
        literal(provenance.sourceLabel, "ROAD 12.00M WIDE", "project.site.road.widthProvenance.sourceLabel");
        return {
            kind: "referencePlanSuppliedUnverified",
            sourceDocument: "OPTION-3.pdf",
            sourceLabel: "ROAD 12.00M WIDE",
        };
    }
    literal(provenance.kind, "legacyProjectUnverified", "project.site.road.widthProvenance.kind");
    if (provenance.sourceDocument !== null)
        fail("project.site.road.widthProvenance.sourceDocument must be null.");
    if (provenance.sourceLabel !== null)
        fail("project.site.road.widthProvenance.sourceLabel must be null.");
    return { kind: "legacyProjectUnverified", sourceDocument: null, sourceLabel: null };
}
/**
 * ProjectV2 A1 files predate schemaRevision and the reserved model slots. This
 * explicit one-way normalization keeps those saves recoverable without treating
 * the legacy room rectangles as topology.
 */
export function normalizeProjectV2(value) {
    const root = record(value, "project");
    literal(root.schemaVersion, 2, "project.schemaVersion");
    if (root.schemaRevision === 3)
        return validateProjectV2(value);
    if (root.schemaRevision === 2)
        return migrateProjectV2Revision2To3(root);
    if (root.schemaRevision !== undefined) {
        fail(`project.schemaRevision ${String(root.schemaRevision)} is not supported for schemaVersion 2.`);
    }
    return migrateProjectV2A1ToRevision3(root);
}
export function migrateProjectV2A1ToRevision3(value) {
    const root = record(value, "project");
    exactKeys(root, ["schemaVersion", "projectId", "name", "units", "coordinateSystem", "site", "building", "legacyEditorState", "recovery"], [], "project");
    literal(root.schemaVersion, 2, "project.schemaVersion");
    const building = record(root.building, "project.building");
    exactKeys(building, ["status", "coverageStatus"], [], "project.building");
    literal(building.status, "deferredToTopologyA2", "project.building.status");
    literal(building.coverageStatus, "deferredToExteriorEnvelopeA4", "project.building.coverageStatus");
    const site = record(root.site, "project.site");
    const road = record(site.road, "project.site.road");
    exactKeys(road, ["edgeIndex", "label", "widthUm"], [], "project.site.road");
    const migrated = structuredClone(root);
    const migratedSite = record(migrated.site, "project.site");
    const migratedRoad = record(migratedSite.road, "project.site.road");
    const widthUm = migratedRoad.widthUm;
    migratedRoad.widthProvenance =
        widthUm === null
            ? null
            : widthUm === 12_000_000
                ? {
                    kind: "referencePlanSuppliedUnverified",
                    sourceDocument: "OPTION-3.pdf",
                    sourceLabel: "ROAD 12.00M WIDE",
                }
                : { kind: "legacyProjectUnverified", sourceDocument: null, sourceLabel: null };
    migrated.schemaRevision = 3;
    const migratedBuilding = record(migrated.building, "project.building");
    migratedBuilding.status = "topologyDeferred";
    migrated.topology = deferredModel("A2");
    migrated.spaces = deferredModel("A2");
    migrated.openings = deferredModel("postA2");
    migrated.dimensions = deferredModel("A2");
    migrated.siteObjects = deferredModel("postA2");
    return validateProjectV2(migrated);
}
export function migrateProjectV2Revision2To3(value) {
    const root = record(value, "project");
    literal(root.schemaVersion, 2, "project.schemaVersion");
    literal(root.schemaRevision, 2, "project.schemaRevision");
    const building = record(root.building, "project.building");
    exactKeys(building, ["status", "coverageStatus"], [], "project.building");
    literal(building.status, "deferredToTopologyA2", "project.building.status");
    literal(building.coverageStatus, "deferredToExteriorEnvelopeA4", "project.building.coverageStatus");
    const topology = validateProjectTopology(root.topology);
    const migrated = structuredClone(root);
    migrated.schemaRevision = 3;
    const migratedBuilding = record(migrated.building, "project.building");
    migratedBuilding.status = topology.status === "active" ? "topologyActive" : "topologyDeferred";
    const migratedLegacy = validateLegacyEditorStateV1(migrated.legacyEditorState, "project.legacyEditorState");
    if (isOption3BaselineLegacyGeometry(migratedLegacy)) {
        const migratedSite = validateSiteV2(migrated.site);
        const storedLegacy = record(migrated.legacyEditorState, "project.legacyEditorState");
        const storedLegacySite = record(storedLegacy.site, "project.legacyEditorState.site");
        storedLegacySite.width = umToLegacyMm(migratedSite.boundary.widthUm);
        storedLegacySite.depth = umToLegacyMm(migratedSite.boundary.depthUm);
    }
    return validateProjectV2(migrated);
}
function deferredModel(targetStage) {
    return { status: "deferred", targetStage, modelVersion: null, data: null };
}
export function detectProjectVersion(value) {
    const root = record(value, "project");
    const version = root.schemaVersion ?? root.version;
    if (version === 2)
        return 2;
    if (version === 1 || version === undefined)
        return 1;
    throw new UnsupportedProjectVersionError(version);
}
export function validateLegacyProjectEnvelopeV1(value) {
    return validateLegacyEditorStateV1(value);
}
function fail(message) {
    throw new ProjectValidationError(message);
}
//# sourceMappingURL=validation.js.map