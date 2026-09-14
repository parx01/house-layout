import { areaUm2, lengthUm } from "../core/units.js";
import type { SiteV2 } from "../core/site.js";
import type { LegacyEditorStateV1, LegacyProjectEnvelopeV1, LegacyRoomV1, LegacyWallV1, ProjectV2 } from "./schema.js";

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

export class UnsupportedProjectVersionError extends Error {
  readonly version: unknown;

  constructor(version: unknown) {
    super(`Unsupported project schema version: ${String(version)}.`);
    this.name = "UnsupportedProjectVersionError";
    this.version = version;
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void {
  for (const key of required) if (!(key in value)) fail(`${path}.${key} is required.`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key} is not supported.`);
}

function finiteNumber(value: unknown, path: string, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) fail(`${path} must be a finite number >= ${min}.`);
  return value;
}

function safeInteger(value: unknown, path: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) fail(`${path} must be a safe integer >= ${min}.`);
  return value;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string.`);
  return value;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(`${path} must be boolean.`);
  return value;
}

function literal<T extends string | number>(value: unknown, expected: T, path: string): T {
  if (value !== expected) fail(`${path} must equal ${JSON.stringify(expected)}.`);
  return expected;
}

function edgeIndex(value: unknown, path: string): 0 | 1 | 2 | 3 {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) fail(`${path} must be 0, 1, 2, or 3.`);
  return value;
}

function nullableSafeLength(value: unknown, path: string) {
  return value === null ? null : lengthUm(safeInteger(value, path), path);
}

export function validateLegacyEditorStateV1(value: unknown, path = "project"): LegacyEditorStateV1 {
  const root = record(value, path);
  exactKeys(root, ["site", "commonAreaMm2", "rooms", "walls", "reference", "snap", "showLabels"], ["version", "schemaVersion", "savedAt"], path);

  const site = record(root.site, `${path}.site`);
  exactKeys(site, ["width", "depth", "coverageLimit"], [], `${path}.site`);
  const width = finiteNumber(site.width, `${path}.site.width`, Number.EPSILON);
  const depth = finiteNumber(site.depth, `${path}.site.depth`, Number.EPSILON);
  const coverageLimit = finiteNumber(site.coverageLimit, `${path}.site.coverageLimit`, Number.EPSILON);
  if (coverageLimit > 1) fail(`${path}.site.coverageLimit cannot exceed 1.`);

  if (!Array.isArray(root.rooms)) fail(`${path}.rooms must be an array.`);
  if (!Array.isArray(root.walls)) fail(`${path}.walls must be an array.`);
  const rooms = root.rooms.map((roomValue, index) => validateLegacyRoom(roomValue, `${path}.rooms[${index}]`));
  const walls = root.walls.map((wallValue, index) => validateLegacyWall(wallValue, `${path}.walls[${index}]`));

  const reference = record(root.reference, `${path}.reference`);
  exactKeys(reference, ["show", "opacity"], [], `${path}.reference`);
  const opacity = finiteNumber(reference.opacity, `${path}.reference.opacity`);
  if (opacity > 1) fail(`${path}.reference.opacity cannot exceed 1.`);

  if (root.version !== undefined) literal(root.version, 1, `${path}.version`);
  if (root.schemaVersion !== undefined) literal(root.schemaVersion, 1, `${path}.schemaVersion`);
  if (root.savedAt !== undefined) stringValue(root.savedAt, `${path}.savedAt`);

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

function validateLegacyRoom(value: unknown, path: string): LegacyRoomV1 {
  const room = record(value, path);
  exactKeys(room, ["id", "name", "x", "y", "width", "height", "included", "hiddenSides"], [], path);
  if (!Array.isArray(room.hiddenSides)) fail(`${path}.hiddenSides must be an array.`);
  const hiddenSides = room.hiddenSides.map((side, index) => {
    if (side !== "top" && side !== "right" && side !== "bottom" && side !== "left") fail(`${path}.hiddenSides[${index}] is invalid.`);
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

function validateLegacyWall(value: unknown, path: string): LegacyWallV1 {
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

export function validateProjectV2(value: unknown): ProjectV2 {
  const root = record(value, "project");
  exactKeys(root, ["schemaVersion", "projectId", "name", "units", "coordinateSystem", "site", "building", "legacyEditorState", "recovery"], [], "project");
  literal(root.schemaVersion, 2, "project.schemaVersion");
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
  const building = record(root.building, "project.building");
  exactKeys(building, ["status", "coverageStatus"], [], "project.building");
  literal(building.status, "deferredToTopologyA2", "project.building.status");
  literal(building.coverageStatus, "deferredToExteriorEnvelopeA4", "project.building.coverageStatus");

  const recovery = record(root.recovery, "project.recovery");
  exactKeys(recovery, ["fixture", "referenceImage", "referenceImageSha256"], [], "project.recovery");
  literal(recovery.fixture, "fixtures/option-3-v1.json", "project.recovery.fixture");
  literal(recovery.referenceImage, "dist/assets/option-3-reference.png", "project.recovery.referenceImage");
  const referenceImageSha256 = stringValue(recovery.referenceImageSha256, "project.recovery.referenceImageSha256");
  if (!/^[a-f0-9]{64}$/.test(referenceImageSha256)) fail("project.recovery.referenceImageSha256 must be a lowercase SHA-256 value.");

  return {
    schemaVersion: 2,
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
    building: { status: "deferredToTopologyA2", coverageStatus: "deferredToExteriorEnvelopeA4" },
    legacyEditorState: validateLegacyEditorStateV1(root.legacyEditorState, "project.legacyEditorState"),
    recovery: {
      fixture: "fixtures/option-3-v1.json",
      referenceImage: "dist/assets/option-3-reference.png",
      referenceImageSha256,
    },
  };
}

function validateSiteV2(value: unknown): SiteV2 {
  const site = record(value, "project.site");
  exactKeys(site, ["boundary", "frontEdgeIndex", "road", "orientation", "coverageRule", "designSetbacks"], [], "project.site");
  const boundary = record(site.boundary, "project.site.boundary");
  exactKeys(boundary, ["kind", "widthUm", "depthUm"], [], "project.site.boundary");
  literal(boundary.kind, "rectangle", "project.site.boundary.kind");
  const widthUm = lengthUm(safeInteger(boundary.widthUm, "project.site.boundary.widthUm", 1));
  const depthUm = lengthUm(safeInteger(boundary.depthUm, "project.site.boundary.depthUm", 1));
  areaUm2(widthUm * depthUm, "project.site.boundary area");

  const road = record(site.road, "project.site.road");
  exactKeys(road, ["edgeIndex", "label", "widthUm"], [], "project.site.road");
  const orientation = record(site.orientation, "project.site.orientation");
  exactKeys(orientation, ["northAngleDeg", "angleReference", "positiveDirection"], [], "project.site.orientation");
  if (orientation.northAngleDeg !== null) {
    const north = finiteNumber(orientation.northAngleDeg, "project.site.orientation.northAngleDeg");
    if (north >= 360) fail("project.site.orientation.northAngleDeg must be less than 360.");
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
  if (rearPreferredUm < rearMinUm) fail("project.site.designSetbacks.rearPreferredUm cannot be less than rearMinUm.");
  const leftUm = lengthUm(safeInteger(setbacks.leftUm, "project.site.designSetbacks.leftUm"));
  const rightUm = lengthUm(safeInteger(setbacks.rightUm, "project.site.designSetbacks.rightUm"));
  const frontMinUm = nullableSafeLength(setbacks.frontMinUm, "project.site.designSetbacks.frontMinUm");
  if (leftUm + rightUm >= widthUm) fail("project.site.designSetbacks side targets leave no buildable width.");
  if (rearMinUm + (frontMinUm ?? 0) >= depthUm) fail("project.site.designSetbacks front/rear targets leave no buildable depth.");
  if (rearPreferredUm + (frontMinUm ?? 0) >= depthUm) fail("project.site.designSetbacks preferred rear target leaves no buildable depth.");

  return {
    boundary: { kind: "rectangle", widthUm, depthUm },
    frontEdgeIndex: edgeIndex(site.frontEdgeIndex, "project.site.frontEdgeIndex"),
    road: {
      edgeIndex: edgeIndex(road.edgeIndex, "project.site.road.edgeIndex"),
      label: stringValue(road.label, "project.site.road.label"),
      widthUm: nullableSafeLength(road.widthUm, "project.site.road.widthUm"),
    },
    orientation: {
      northAngleDeg: orientation.northAngleDeg as number | null,
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

export function detectProjectVersion(value: unknown): 1 | 2 {
  const root = record(value, "project");
  const version = root.schemaVersion ?? root.version;
  if (version === 2) return 2;
  if (version === 1 || version === undefined) return 1;
  throw new UnsupportedProjectVersionError(version);
}

export function validateLegacyProjectEnvelopeV1(value: unknown): LegacyProjectEnvelopeV1 {
  return validateLegacyEditorStateV1(value) as LegacyProjectEnvelopeV1;
}

function fail(message: string): never {
  throw new ProjectValidationError(message);
}
