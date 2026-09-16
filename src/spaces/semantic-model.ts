import { extractBoundedFaces } from "./extract-faces.js";
import { faceId, type FaceId } from "./model.js";
import type { TopologyV2 } from "../topology/model.js";

declare const spaceIdBrand: unique symbol;
export type SpaceId = string & { readonly [spaceIdBrand]: "SpaceId" };

export const SPACE_CATEGORIES = ["room", "circulation", "service", "storage", "other"] as const;
export type SpaceCategory = (typeof SPACE_CATEGORIES)[number];

export const ARCHITECTURAL_SPACE_ROLES = [
  "ordinaryRoom",
  "circulation",
  "staircase",
  "service",
  "storage",
  "courtyardVoid",
  "otherSpecialUse",
  "unclassified",
] as const;
export type ArchitecturalSpaceRole = (typeof ARCHITECTURAL_SPACE_ROLES)[number];

export const SPACE_ENCLOSURES = ["enclosedCovered", "openToSky", "unclassified"] as const;
export type SpaceEnclosure = (typeof SPACE_ENCLOSURES)[number];

export interface SemanticSpaceV1 {
  readonly id: SpaceId;
  readonly name: string;
  readonly category: SpaceCategory;
  /** Current binding only; the face polygon and area remain derived. */
  readonly faceId: FaceId;
}

export interface SemanticSpacesV1 {
  readonly status: "active";
  readonly modelVersion: 1;
  readonly spaces: readonly SemanticSpaceV1[];
}

export interface SemanticSpaceV2 extends SemanticSpaceV1 {
  /** Explicit architectural meaning; never inferred from the base category. */
  readonly architecturalRole: ArchitecturalSpaceRole;
  /** Physical enclosure only. A4 separately owns whether/how this counts as coverage. */
  readonly enclosure: SpaceEnclosure;
}

export interface SemanticSpacesV2 {
  readonly status: "active";
  readonly modelVersion: 2;
  readonly spaces: readonly SemanticSpaceV2[];
}

export class SemanticSpaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticSpaceValidationError";
  }
}

export function spaceId(value: string): SpaceId {
  if (!/^s-[a-z0-9][a-z0-9-]{0,62}$/.test(value)) {
    throw new SemanticSpaceValidationError(
      `Invalid persistent space ID ${JSON.stringify(value)}; expected s- followed by lowercase letters, digits, or hyphens.`,
    );
  }
  return value as SpaceId;
}

/**
 * Validates persistent semantics against the current derived face set. This
 * never copies face polygons or areas into the semantic model.
 */
export function validateSemanticSpacesV1(
  value: unknown,
  topology: TopologyV2,
  path = "spaces",
): SemanticSpacesV1 {
  const root = record(value, path);
  exactKeys(root, ["status", "modelVersion", "spaces"], path);
  literal(root.status, "active", `${path}.status`);
  literal(root.modelVersion, 1, `${path}.modelVersion`);
  if (!Array.isArray(root.spaces)) fail(`${path}.spaces must be an array.`);

  const validFaceIds = new Set(extractBoundedFaces(topology).faces.map((face) => face.id));
  const seenSpaceIds = new Set<string>();
  const boundFaceIds = new Set<string>();
  const spaces = root.spaces.map((candidate, index) => {
    const space = validateSemanticSpace(candidate, `${path}.spaces[${index}]`);
    if (seenSpaceIds.has(space.id)) fail(`${path}.spaces contains duplicate space ID ${space.id}.`);
    seenSpaceIds.add(space.id);
    if (boundFaceIds.has(space.faceId)) fail(`${path}.spaces contains duplicate face binding ${space.faceId}.`);
    boundFaceIds.add(space.faceId);
    if (!validFaceIds.has(space.faceId)) {
      fail(`${path}.spaces[${index}].faceId references orphaned derived face ${space.faceId}.`);
    }
    return space;
  });

  return { status: "active", modelVersion: 1, spaces };
}

export function validateSemanticSpacesV2(
  value: unknown,
  topology: TopologyV2,
  path = "spaces",
): SemanticSpacesV2 {
  const root = record(value, path);
  exactKeys(root, ["status", "modelVersion", "spaces"], path);
  literal(root.status, "active", `${path}.status`);
  literal(root.modelVersion, 2, `${path}.modelVersion`);
  if (!Array.isArray(root.spaces)) fail(`${path}.spaces must be an array.`);

  const validFaceIds = new Set(extractBoundedFaces(topology).faces.map((face) => face.id));
  const seenSpaceIds = new Set<string>();
  const boundFaceIds = new Set<string>();
  const spaces = root.spaces.map((candidate, index) => {
    const space = validateSemanticSpaceV2(candidate, `${path}.spaces[${index}]`);
    if (seenSpaceIds.has(space.id)) fail(`${path}.spaces contains duplicate space ID ${space.id}.`);
    seenSpaceIds.add(space.id);
    if (boundFaceIds.has(space.faceId)) fail(`${path}.spaces contains duplicate face binding ${space.faceId}.`);
    boundFaceIds.add(space.faceId);
    if (!validFaceIds.has(space.faceId)) {
      fail(`${path}.spaces[${index}].faceId references orphaned derived face ${space.faceId}.`);
    }
    return space;
  });

  return { status: "active", modelVersion: 2, spaces };
}

/**
 * Validates the stronger A3-closure contract required before deriving a fully
 * understood architectural model. Historical migrations may remain
 * structurally active with explicit `unclassified` values; they must not pass
 * this gate until a human completes their classification.
 */
export function validateCompleteSemanticSpacesV2(
  value: unknown,
  topology: TopologyV2,
  path = "spaces",
): SemanticSpacesV2 {
  const spaces = validateSemanticSpacesV2(value, topology, path);
  const boundedFaceIds = extractBoundedFaces(topology).faces.map((face) => face.id).sort();
  const claimedFaceIds = new Set(spaces.spaces.map((space) => space.faceId));
  const unclaimedFaceIds = boundedFaceIds.filter((identity) => !claimedFaceIds.has(identity));
  if (unclaimedFaceIds.length > 0) {
    fail(`${path} does not claim every bounded face; unclaimed faces: ${unclaimedFaceIds.join(", ")}.`);
  }
  const unclassifiedSpaceIds = spaces.spaces
    .filter((space) => space.architecturalRole === "unclassified" || space.enclosure === "unclassified")
    .map((space) => space.id)
    .sort();
  if (unclassifiedSpaceIds.length > 0) {
    fail(`${path} is not A3-complete; unclassified spaces: ${unclassifiedSpaceIds.join(", ")}.`);
  }
  return spaces;
}

/** Revision-safe migration. Unknown V1 intent stays explicit instead of being guessed from category/name. */
export function migrateSemanticSpacesV1ToV2(
  value: unknown,
  topology: TopologyV2,
  path = "spaces",
): SemanticSpacesV2 {
  const previous = validateSemanticSpacesV1(value, topology, path);
  return validateSemanticSpacesV2(
    {
      status: "active",
      modelVersion: 2,
      spaces: previous.spaces.map((space) => ({
        ...space,
        architecturalRole: "unclassified",
        enclosure: "unclassified",
      })),
    },
    topology,
    path,
  );
}

function validateSemanticSpace(value: unknown, path: string): SemanticSpaceV1 {
  const entry = record(value, path);
  exactKeys(entry, ["id", "name", "category", "faceId"], path);
  const name = stringValue(entry.name, `${path}.name`);
  if (name !== name.trim()) fail(`${path}.name must not have leading or trailing whitespace.`);
  if (name.length > 120) fail(`${path}.name cannot exceed 120 characters.`);
  return {
    id: spaceId(stringValue(entry.id, `${path}.id`)),
    name,
    category: category(entry.category, `${path}.category`),
    faceId: faceId(stringValue(entry.faceId, `${path}.faceId`)),
  };
}

function validateSemanticSpaceV2(value: unknown, path: string): SemanticSpaceV2 {
  const entry = record(value, path);
  exactKeys(entry, ["id", "name", "category", "faceId", "architecturalRole", "enclosure"], path);
  const core = validateSemanticSpace(
    { id: entry.id, name: entry.name, category: entry.category, faceId: entry.faceId },
    path,
  );
  const architecturalRole = enumValue(
    entry.architecturalRole,
    ARCHITECTURAL_SPACE_ROLES,
    `${path}.architecturalRole`,
  );
  const enclosure = enumValue(entry.enclosure, SPACE_ENCLOSURES, `${path}.enclosure`);
  if (architecturalRole === "courtyardVoid" && enclosure !== "openToSky") {
    fail(`${path}.enclosure must equal "openToSky" when architecturalRole is "courtyardVoid".`);
  }
  return { ...core, architecturalRole, enclosure };
}

function category(value: unknown, path: string): SpaceCategory {
  if (typeof value !== "string" || !SPACE_CATEGORIES.includes(value as SpaceCategory)) {
    fail(`${path} must be one of ${SPACE_CATEGORIES.join(", ")}.`);
  }
  return value as SpaceCategory;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`${path} must be one of ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], path: string): void {
  for (const key of required) if (!(key in value)) fail(`${path}.${key} is required.`);
  const allowed = new Set(required);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key} is not supported.`);
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string.`);
  return value;
}

function literal<T extends string | number>(value: unknown, expected: T, path: string): T {
  if (value !== expected) fail(`${path} must equal ${JSON.stringify(expected)}.`);
  return expected;
}

function fail(message: string): never {
  throw new SemanticSpaceValidationError(message);
}
