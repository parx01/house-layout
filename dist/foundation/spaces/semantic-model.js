import { extractBoundedFaces } from "./extract-faces.js";
import { faceId } from "./model.js";
export const SPACE_CATEGORIES = ["room", "circulation", "service", "storage", "other"];
export class SemanticSpaceValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "SemanticSpaceValidationError";
    }
}
export function spaceId(value) {
    if (!/^s-[a-z0-9][a-z0-9-]{0,62}$/.test(value)) {
        throw new SemanticSpaceValidationError(`Invalid persistent space ID ${JSON.stringify(value)}; expected s- followed by lowercase letters, digits, or hyphens.`);
    }
    return value;
}
/**
 * Validates persistent semantics against the current derived face set. This
 * never copies face polygons or areas into the semantic model.
 */
export function validateSemanticSpacesV1(value, topology, path = "spaces") {
    const root = record(value, path);
    exactKeys(root, ["status", "modelVersion", "spaces"], path);
    literal(root.status, "active", `${path}.status`);
    literal(root.modelVersion, 1, `${path}.modelVersion`);
    if (!Array.isArray(root.spaces))
        fail(`${path}.spaces must be an array.`);
    const validFaceIds = new Set(extractBoundedFaces(topology).faces.map((face) => face.id));
    const seenSpaceIds = new Set();
    const boundFaceIds = new Set();
    const spaces = root.spaces.map((candidate, index) => {
        const space = validateSemanticSpace(candidate, `${path}.spaces[${index}]`);
        if (seenSpaceIds.has(space.id))
            fail(`${path}.spaces contains duplicate space ID ${space.id}.`);
        seenSpaceIds.add(space.id);
        if (boundFaceIds.has(space.faceId))
            fail(`${path}.spaces contains duplicate face binding ${space.faceId}.`);
        boundFaceIds.add(space.faceId);
        if (!validFaceIds.has(space.faceId)) {
            fail(`${path}.spaces[${index}].faceId references orphaned derived face ${space.faceId}.`);
        }
        return space;
    });
    return { status: "active", modelVersion: 1, spaces };
}
function validateSemanticSpace(value, path) {
    const entry = record(value, path);
    exactKeys(entry, ["id", "name", "category", "faceId"], path);
    const name = stringValue(entry.name, `${path}.name`);
    if (name !== name.trim())
        fail(`${path}.name must not have leading or trailing whitespace.`);
    if (name.length > 120)
        fail(`${path}.name cannot exceed 120 characters.`);
    return {
        id: spaceId(stringValue(entry.id, `${path}.id`)),
        name,
        category: category(entry.category, `${path}.category`),
        faceId: faceId(stringValue(entry.faceId, `${path}.faceId`)),
    };
}
function category(value, path) {
    if (typeof value !== "string" || !SPACE_CATEGORIES.includes(value)) {
        fail(`${path} must be one of ${SPACE_CATEGORIES.join(", ")}.`);
    }
    return value;
}
function record(value, path) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        fail(`${path} must be an object.`);
    return value;
}
function exactKeys(value, required, path) {
    for (const key of required)
        if (!(key in value))
            fail(`${path}.${key} is required.`);
    const allowed = new Set(required);
    for (const key of Object.keys(value))
        if (!allowed.has(key))
            fail(`${path}.${key} is not supported.`);
}
function stringValue(value, path) {
    if (typeof value !== "string" || value.length === 0)
        fail(`${path} must be a non-empty string.`);
    return value;
}
function literal(value, expected, path) {
    if (value !== expected)
        fail(`${path} must equal ${JSON.stringify(expected)}.`);
    return expected;
}
function fail(message) {
    throw new SemanticSpaceValidationError(message);
}
//# sourceMappingURL=semantic-model.js.map