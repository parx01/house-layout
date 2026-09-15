import { extractBoundedFaces } from "./extract-faces.js";
import { validateSemanticSpacesV1, } from "./semantic-model.js";
/**
 * Reconciles persistent semantic identities with a newly derived face set.
 *
 * Face IDs that survive are preserved directly. A changed FaceId is rebound
 * only when exact polygon overlap establishes a mutual one-to-one
 * correspondence and the faces retain canonical boundary geometry. Splits,
 * merges, deletions, and weak/ambiguous matches remain explicit for a later
 * human remapping workflow.
 */
export function reconcileSemanticSpaces(spacesValue, previousTopology, candidateTopology) {
    const spaces = validateSemanticSpacesV1(spacesValue, previousTopology, "spaces");
    const previousFaces = extractBoundedFaces(previousTopology).faces;
    const candidateFaces = extractBoundedFaces(candidateTopology).faces;
    const previousById = new Map(previousFaces.map((face) => [face.id, face]));
    const candidateById = new Map(candidateFaces.map((face) => [face.id, face]));
    const overlaps = createOverlapIndex(previousFaces, candidateFaces);
    const claimedFaceIds = new Set();
    const preservedBindings = [];
    const reboundBindings = [];
    const unresolvedSpaces = [];
    const reboundBySpaceId = new Map();
    const orderedSpaces = [...spaces.spaces].sort((left, right) => left.id.localeCompare(right.id));
    for (const space of orderedSpaces) {
        if (candidateById.has(space.faceId)) {
            preservedBindings.push({ spaceId: space.id, faceId: space.faceId });
            claimedFaceIds.add(space.faceId);
            continue;
        }
        const previousFace = previousById.get(space.faceId);
        const candidates = overlaps.get(previousFace.id) ?? [];
        if (candidates.length === 0) {
            unresolvedSpaces.push(unresolved(space.id, space.faceId, "orphanedFace", []));
            continue;
        }
        if (candidates.length > 1) {
            unresolvedSpaces.push(unresolved(space.id, space.faceId, "faceSplit", candidates.map((candidate) => candidate.face.id)));
            continue;
        }
        const candidate = candidates[0];
        const overlappingPreviousFaces = previousFaces.filter((face) => (overlaps.get(face.id) ?? []).some((entry) => entry.face.id === candidate.face.id));
        if (overlappingPreviousFaces.length > 1) {
            unresolvedSpaces.push(unresolved(space.id, space.faceId, "faceMerge", [candidate.face.id]));
            continue;
        }
        if (claimedFaceIds.has(candidate.face.id) || !hasStrongContinuity(candidate.evidence)) {
            unresolvedSpaces.push(unresolved(space.id, space.faceId, "ambiguousCorrespondence", [candidate.face.id]));
            continue;
        }
        reboundBindings.push({
            spaceId: space.id,
            previousFaceId: space.faceId,
            faceId: candidate.face.id,
            evidence: candidate.evidence,
        });
        reboundBySpaceId.set(space.id, candidate.face.id);
        claimedFaceIds.add(candidate.face.id);
    }
    const unclaimedFaceIds = candidateFaces
        .map((face) => face.id)
        .filter((identity) => !claimedFaceIds.has(identity))
        .sort();
    const previousFaceIds = new Set(previousFaces.map((face) => face.id));
    const newFaceIds = candidateFaces.map((face) => face.id).filter((identity) => !previousFaceIds.has(identity)).sort();
    const reportBase = {
        preservedBindings: preservedBindings.sort(compareBindings),
        reboundBindings: reboundBindings.sort(compareBindings),
        unresolvedSpaces: unresolvedSpaces.sort(compareBindings),
        newFaceIds,
        unclaimedFaceIds,
    };
    if (unresolvedSpaces.length > 0) {
        return { status: "remapRequired", report: { status: "remapRequired", ...reportBase } };
    }
    const reboundSpaces = {
        status: "active",
        modelVersion: 1,
        spaces: spaces.spaces.map((space) => ({
            ...space,
            faceId: reboundBySpaceId.get(space.id) ?? space.faceId,
        })),
    };
    return {
        status: "resolved",
        spaces: validateSemanticSpacesV1(reboundSpaces, candidateTopology, "spaces"),
        report: { status: "resolved", ...reportBase },
    };
}
function createOverlapIndex(previousFaces, candidateFaces) {
    const result = new Map();
    for (const previous of previousFaces) {
        const candidates = candidateFaces
            .map((candidate) => ({ face: candidate, evidence: correspondenceEvidence(previous, candidate) }))
            .filter((candidate) => candidate.evidence.overlapAreaUm2 > 0)
            .sort((left, right) => left.face.id.localeCompare(right.face.id));
        result.set(previous.id, candidates);
    }
    return result;
}
function correspondenceEvidence(previous, candidate) {
    const overlapAreaUm2 = exactOrthogonalOverlapArea(previous, candidate);
    const previousCoveragePpm = coveragePpm(overlapAreaUm2, previous.areaUm2);
    const candidateFaceCoveragePpm = coveragePpm(overlapAreaUm2, candidate.areaUm2);
    const sharedCanonicalWallIds = [...new Set(previous.boundary.map((edge) => edge.wallId))]
        .filter((identity) => candidate.boundary.some((edge) => edge.wallId === identity))
        .sort();
    return {
        overlapAreaUm2,
        previousFaceCoveragePpm: previousCoveragePpm,
        candidateFaceCoveragePpm,
        sharedBoundaryLengthUm: sharedBoundaryLength(previous, candidate),
        sharedCanonicalWallIds,
        containment: previousCoveragePpm === 1_000_000 && candidateFaceCoveragePpm === 1_000_000
            ? "sameGeometry"
            : candidateFaceCoveragePpm === 1_000_000
                ? "previousContainsCandidate"
                : previousCoveragePpm === 1_000_000
                    ? "candidateContainsPrevious"
                    : "none",
    };
}
function hasStrongContinuity(evidence) {
    const contained = evidence.containment !== "none";
    const majorityOverlap = evidence.previousFaceCoveragePpm > 500_000 && evidence.candidateFaceCoveragePpm > 500_000;
    return evidence.sharedBoundaryLengthUm > 0 && (contained || majorityOverlap);
}
/** Exact area intersection for simple orthogonal polygons using integer cell decomposition. */
function exactOrthogonalOverlapArea(left, right) {
    const xs = uniqueSorted([...left.vertices.map((point) => point.xUm), ...right.vertices.map((point) => point.xUm)]);
    const ys = uniqueSorted([...left.vertices.map((point) => point.yUm), ...right.vertices.map((point) => point.yUm)]);
    let total = 0n;
    for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
        const minX = xs[xIndex];
        const maxX = xs[xIndex + 1];
        for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
            const minY = ys[yIndex];
            const maxY = ys[yIndex + 1];
            const midpointX2 = BigInt(minX) + BigInt(maxX);
            const midpointY2 = BigInt(minY) + BigInt(maxY);
            if (containsDoubledPoint(left, midpointX2, midpointY2) && containsDoubledPoint(right, midpointX2, midpointY2)) {
                total += BigInt(maxX - minX) * BigInt(maxY - minY);
            }
        }
    }
    const value = Number(total);
    if (!Number.isSafeInteger(value))
        throw new RangeError("Face overlap area exceeds safe integer precision.");
    return value;
}
function containsDoubledPoint(face, x2, y2) {
    let inside = false;
    for (let index = 0; index < face.vertices.length; index += 1) {
        const start = face.vertices[index];
        const end = face.vertices[(index + 1) % face.vertices.length];
        if (start.xUm !== end.xUm)
            continue;
        const minY2 = BigInt(Math.min(start.yUm, end.yUm)) * 2n;
        const maxY2 = BigInt(Math.max(start.yUm, end.yUm)) * 2n;
        if (y2 > minY2 && y2 < maxY2 && BigInt(start.xUm) * 2n > x2)
            inside = !inside;
    }
    return inside;
}
function sharedBoundaryLength(left, right) {
    let total = 0;
    for (let leftIndex = 0; leftIndex < left.vertices.length; leftIndex += 1) {
        const leftStart = left.vertices[leftIndex];
        const leftEnd = left.vertices[(leftIndex + 1) % left.vertices.length];
        for (let rightIndex = 0; rightIndex < right.vertices.length; rightIndex += 1) {
            const rightStart = right.vertices[rightIndex];
            const rightEnd = right.vertices[(rightIndex + 1) % right.vertices.length];
            if (leftStart.xUm === leftEnd.xUm && rightStart.xUm === rightEnd.xUm && leftStart.xUm === rightStart.xUm) {
                total += intervalOverlap(leftStart.yUm, leftEnd.yUm, rightStart.yUm, rightEnd.yUm);
            }
            else if (leftStart.yUm === leftEnd.yUm &&
                rightStart.yUm === rightEnd.yUm &&
                leftStart.yUm === rightStart.yUm) {
                total += intervalOverlap(leftStart.xUm, leftEnd.xUm, rightStart.xUm, rightEnd.xUm);
            }
        }
    }
    return total;
}
function intervalOverlap(leftA, leftB, rightA, rightB) {
    return Math.max(0, Math.min(Math.max(leftA, leftB), Math.max(rightA, rightB)) -
        Math.max(Math.min(leftA, leftB), Math.min(rightA, rightB)));
}
function coveragePpm(overlap, area) {
    return Number((BigInt(overlap) * 1000000n) / BigInt(area));
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left - right);
}
function unresolved(spaceIdentity, previousFaceId, reason, candidateFaceIds) {
    return { spaceId: spaceIdentity, previousFaceId, reason, candidateFaceIds: [...candidateFaceIds].sort() };
}
function compareBindings(left, right) {
    return left.spaceId.localeCompare(right.spaceId);
}
//# sourceMappingURL=semantic-rebinding.js.map