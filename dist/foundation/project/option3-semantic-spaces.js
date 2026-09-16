import { formatSquareFeet } from "../core/units.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { faceId } from "../spaces/model.js";
import { spaceId, validateCompleteSemanticSpacesV2, } from "../spaces/semantic-model.js";
import { createOption3TopologyV2 } from "./option3-topology.js";
/**
 * Deliberate A3.2 bindings for the one curated Option-3 baseline. Face IDs are
 * literal references to the A2.4 output: this is not a geometry/name heuristic.
 */
export const OPTION_3_CURATED_SPACE_BINDINGS = [
    binding("s-bedroom-1", "Bedroom 1", "room", "ordinaryRoom", "enclosedCovered", "f-dde2d722d470e5e8", "Rear-left bay, west of the paired rear toilet/dress core; matches the left BED ROOM label."),
    binding("s-toilet-1", "Toilet 1", "service", "service", "enclosedCovered", "f-4500a68c39844fc4", "Rear wet core, upper-left cell between the rear wall and rear wet-room split."),
    binding("s-dress-1", "Dress 1", "storage", "storage", "enclosedCovered", "f-25299ab9d0600da6", "Rear wet core, lower-left cell directly below Toilet 1; matches the left DRESS. label."),
    binding("s-toilet-2", "Toilet 2", "service", "service", "enclosedCovered", "f-41bc3b811ac8bc6a", "Rear wet core, upper-right cell between the rear wall and rear wet-room split."),
    binding("s-dress-2", "Dress 2", "storage", "storage", "enclosedCovered", "f-07944bbfa1fe0b50", "Rear wet core, lower-right cell directly below Toilet 2; matches the right DRESS. label."),
    binding("s-bedroom-2", "Bedroom 2", "room", "ordinaryRoom", "enclosedCovered", "f-46f1f10484862bb1", "Rear-right bay, east of the paired rear toilet/dress core; matches the right BED ROOM label."),
    binding("s-lobby-dining-puja", "Lobby / Dining with Puja Alcove", "other", "circulation", "enclosedCovered", "f-c26ea4cfc8e5967d", "Large central face. The reference's PUJA RM. alcove has three walls and is open on its right to LOBBY / DINING, so both labels occupy one canonical face."),
    binding("s-kitchen", "Kitchen", "service", "service", "enclosedCovered", "f-995c81a969eb9c62", "Left-middle closed cell below the puja/lobby opening and above the staircase; matches KITCHEN."),
    binding("s-staircase", "Staircase", "circulation", "staircase", "enclosedCovered", "f-5bd20450438f7e84", "Left-front stepped cell below Kitchen; matches STAIRCASE and its upper landing projection."),
    binding("s-living-room", "Living Room", "room", "ordinaryRoom", "enclosedCovered", "f-b90cdc1e2457fadd", "Front-left room east of the staircase and west of the wash/toilet stack; matches LIVING ROOM."),
    binding("s-wash-area", "Wash Area", "service", "service", "enclosedCovered", "f-c4be109283d52551", "Front central stack, upper cell between Living Room and Guest Bedroom; matches W.B.AREA."),
    binding("s-toilet-3", "Toilet 3", "service", "service", "enclosedCovered", "f-ce4b77ad898b046f", "Front central stack, lower cell directly below Wash Area; matches TOILET."),
    binding("s-guest-bedroom", "Guest Bedroom", "room", "ordinaryRoom", "enclosedCovered", "f-9b08821b6b5e1967", "Front-right bay east of the wash/toilet stack; matches GUEST BED ROOM."),
];
export function createOption3SemanticSpacesV2() {
    const topology = createOption3TopologyV2();
    return validateCompleteSemanticSpacesV2({
        status: "active",
        modelVersion: 2,
        spaces: OPTION_3_CURATED_SPACE_BINDINGS.map(({ id, name, category, architecturalRole, enclosure, faceId: boundFaceId }) => ({
            id,
            name,
            category,
            architecturalRole,
            enclosure,
            faceId: boundFaceId,
        })),
    }, topology, "option3.spaces");
}
/** @deprecated Use createOption3SemanticSpacesV2. The returned current model is V2. */
export const createOption3SemanticSpacesV1 = createOption3SemanticSpacesV2;
/** Derived audit rows. Areas and boundary references are never persisted. */
export function createOption3SemanticSpaceMappingRows() {
    const topology = createOption3TopologyV2();
    const faces = new Map(extractBoundedFaces(topology).faces.map((face) => [face.id, face]));
    return OPTION_3_CURATED_SPACE_BINDINGS.map((bindingValue) => {
        const face = faces.get(bindingValue.faceId);
        if (!face)
            throw new Error(`Curated Option-3 binding ${bindingValue.id} references missing ${bindingValue.faceId}.`);
        return {
            ...bindingValue,
            areaUm2: face.areaUm2,
            areaLabel: formatSquareFeet(face.areaUm2, 1),
            boundaryWallIds: face.boundary.map((halfEdge) => halfEdge.wallId),
        };
    });
}
function binding(id, name, category, architecturalRole, enclosure, boundFaceId, locationEvidence) {
    return { id: spaceId(id), name, category, architecturalRole, enclosure, faceId: faceId(boundFaceId), locationEvidence };
}
//# sourceMappingURL=option3-semantic-spaces.js.map