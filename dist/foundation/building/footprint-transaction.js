import { deriveExteriorBoundary } from "./exterior-boundary.js";
import { derivePhysicalExteriorEnvelope, physicalExteriorEnvelopeGeometryEquals, } from "./physical-exterior-envelope.js";
import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { validateTopologyV2 } from "../topology/validation.js";
/**
 * Runs an existing A2.5 movement and derives its footprint consequences.
 * Geometry remains owned by A2.5; this function only validates and reports the
 * candidate transaction. Rejections never expose a topology to commit.
 */
export function evaluateFootprintMoveTransaction(topologyValue, movement) {
    const before = validateTopologyV2(topologyValue, "footprintTransaction.topology");
    const beforeEnvelope = derivePhysicalExteriorEnvelope(before);
    try {
        const result = movement(structuredClone(before));
        if (!result || typeof result !== "object" || !result.metadata || !result.topology) {
            throw new TypeError("A2.5 movement did not return topology and metadata.");
        }
        const after = validateTopologyV2(result.topology, "footprintTransaction.candidateTopology");
        assertSameCanonicalEntities(before, after);
        assertFacesPreserved(before, after);
        const affectedNodeIds = deriveAffectedNodeIds(before, after);
        const affectedWallIds = deriveAffectedWallIds(before, affectedNodeIds);
        assertMetadataMatches(result.metadata, before, after, affectedNodeIds, affectedWallIds);
        const beforeBoundary = deriveExteriorBoundary(before);
        const afterBoundary = deriveExteriorBoundary(after);
        assertClassificationsPreserved(beforeBoundary, afterBoundary);
        const afterEnvelope = derivePhysicalExteriorEnvelope(after);
        return {
            status: "committed",
            committedTopology: after,
            movementMetadata: structuredClone(result.metadata),
            affectedNodeIds,
            affectedWallIds,
            involvedWallClassifications: classifyAffectedWalls(affectedWallIds, beforeBoundary),
            beforeEnvelope,
            afterEnvelope,
            footprintChanged: !physicalExteriorEnvelopeGeometryEquals(beforeEnvelope, afterEnvelope),
        };
    }
    catch (error) {
        return {
            status: "rejected",
            reason: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : "UnknownError",
            affectedNodeIds: [],
            affectedWallIds: [],
            involvedWallClassifications: emptyClassifications(),
            beforeEnvelope,
            afterEnvelope: beforeEnvelope,
            footprintChanged: false,
        };
    }
}
function assertSameCanonicalEntities(before, after) {
    const beforeNodeIds = Object.keys(before.nodes).sort();
    const afterNodeIds = Object.keys(after.nodes).sort();
    const beforeWallIds = Object.keys(before.walls).sort();
    const afterWallIds = Object.keys(after.walls).sort();
    if (!equalStrings(beforeNodeIds, afterNodeIds) || !equalStrings(beforeWallIds, afterWallIds)) {
        throw new Error("A2.5 movement must preserve every canonical node and wall ID.");
    }
    for (const identity of beforeWallIds) {
        const previous = before.walls[identity];
        const candidate = after.walls[identity];
        if (previous.startNodeId !== candidate.startNodeId ||
            previous.endNodeId !== candidate.endNodeId ||
            previous.thicknessUm !== candidate.thicknessUm) {
            throw new Error(`A2.5 movement changed identity, connectivity, or thickness of wall ${identity}.`);
        }
    }
}
function assertFacesPreserved(before, after) {
    const beforeFaceIds = extractBoundedFaces(before).faces.map((face) => face.id).sort();
    const afterFaceIds = extractBoundedFaces(after).faces.map((face) => face.id).sort();
    if (!equalStrings(beforeFaceIds, afterFaceIds)) {
        throw new Error("A2.5 movement changed bounded-face identity.");
    }
}
function deriveAffectedNodeIds(before, after) {
    return Object.keys(before.nodes).sort().filter((identity) => before.nodes[identity].xUm !== after.nodes[identity].xUm ||
        before.nodes[identity].yUm !== after.nodes[identity].yUm);
}
function deriveAffectedWallIds(before, affectedNodeIds) {
    const affectedNodes = new Set(affectedNodeIds);
    return Object.keys(before.walls).sort().filter((identity) => {
        const wall = before.walls[identity];
        return affectedNodes.has(wall.startNodeId) || affectedNodes.has(wall.endNodeId);
    });
}
function assertMetadataMatches(metadata, before, after, affectedNodeIds, affectedWallIds) {
    const metadataNodeIds = metadata.nodeChanges.map((change) => change.nodeId).sort();
    const metadataWallIds = [...metadata.affectedWallIds].sort();
    if (!equalStrings(metadataNodeIds, affectedNodeIds)) {
        throw new Error("A2.5 movement node-change metadata does not match the candidate topology.");
    }
    if (!equalStrings(metadataWallIds, affectedWallIds)) {
        throw new Error("A2.5 movement affected-wall metadata does not match the candidate topology.");
    }
    for (const change of metadata.nodeChanges) {
        const previous = before.nodes[change.nodeId];
        const candidate = after.nodes[change.nodeId];
        if (change.before.xUm !== previous.xUm ||
            change.before.yUm !== previous.yUm ||
            change.after.xUm !== candidate.xUm ||
            change.after.yUm !== candidate.yUm) {
            throw new Error(`A2.5 movement coordinate metadata does not match node ${change.nodeId}.`);
        }
    }
}
function emptyClassifications() {
    return {
        exteriorWallIds: [],
        internalSharedWallIds: [],
        nonFaceBoundaryWallIds: [],
    };
}
function assertClassificationsPreserved(before, after) {
    if (!equalStrings(before.exteriorWallIds, after.exteriorWallIds) ||
        !equalStrings(before.internalSharedWallIds, after.internalSharedWallIds) ||
        !equalStrings(before.nonFaceBoundaryWallIds, after.nonFaceBoundaryWallIds)) {
        throw new Error("A2.5 movement changed canonical wall boundary classification.");
    }
}
function classifyAffectedWalls(affectedWallIds, boundary) {
    const affected = new Set(affectedWallIds);
    return {
        exteriorWallIds: boundary.exteriorWallIds.filter((identity) => affected.has(identity)),
        internalSharedWallIds: boundary.internalSharedWallIds.filter((identity) => affected.has(identity)),
        nonFaceBoundaryWallIds: boundary.nonFaceBoundaryWallIds.filter((identity) => affected.has(identity)),
    };
}
function equalStrings(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
//# sourceMappingURL=footprint-transaction.js.map