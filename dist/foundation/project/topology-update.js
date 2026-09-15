import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { reconcileSemanticSpaces, } from "../spaces/semantic-rebinding.js";
import { validateTopologyV2 } from "../topology/validation.js";
import { validateProjectV2 } from "./validation.js";
export class ProjectTopologyUpdateError extends Error {
    stage;
    reconciliation;
    constructor(stage, message, options, reconciliation) {
        super(message, options);
        this.stage = stage;
        this.reconciliation = reconciliation;
        this.name = "ProjectTopologyUpdateError";
    }
}
/**
 * Atomically accepts an A2.5 movement result as the project's new canonical
 * topology. Legacy rectangles are intentionally untouched reference data.
 */
export function applyTopologyMoveResult(projectValue, moveResult) {
    return applyTopologyMoveTransaction(projectValue, moveResult).project;
}
/** A2.5-compatible wrapper that also exposes the A3.3 reconciliation report. */
export function applyTopologyMoveTransaction(projectValue, moveResult) {
    const project = validateInputProject(projectValue);
    if (project.topology.status !== "active") {
        throw new ProjectTopologyUpdateError("inputProject", "A topology movement requires an active project topology.");
    }
    if (!moveResult || typeof moveResult !== "object" || !moveResult.metadata) {
        throw new ProjectTopologyUpdateError("moveResult", "Topology move result is missing required metadata.");
    }
    let candidateTopology;
    try {
        candidateTopology = validateTopologyV2(moveResult.topology, "moveResult.topology");
    }
    catch (error) {
        throw updateError("moveResult", `Topology move result is invalid: ${errorMessage(error)}`, error);
    }
    const beforeFaceIds = extractBoundedFaces(project.topology).faces.map((face) => face.id);
    const afterFaceIds = extractBoundedFaces(candidateTopology).faces.map((face) => face.id);
    assertSameEntities(project.topology, candidateTopology);
    assertNodeChangesMatch(project.topology, candidateTopology, moveResult);
    const metadataFaceIds = [...moveResult.metadata.preservedFaceIds];
    const metadataMatches = moveResult.metadata.faceCountBefore === beforeFaceIds.length &&
        moveResult.metadata.faceCountAfter === afterFaceIds.length &&
        equalIds(metadataFaceIds, beforeFaceIds);
    if (!metadataMatches) {
        throw new ProjectTopologyUpdateError("moveResult", "Topology move metadata does not match the current project faces.");
    }
    if (!equalIds(beforeFaceIds, afterFaceIds)) {
        throw new ProjectTopologyUpdateError("moveResult", "A2.5 movement rejected because derived face identities changed.");
    }
    const transaction = applyCanonicalTopologyUpdate(project, candidateTopology);
    if (transaction.status === "remapRequired") {
        throw new ProjectTopologyUpdateError("semanticSpaces", "Topology move requires explicit semantic remapping and was not committed.", undefined, transaction.reconciliation);
    }
    return transaction;
}
/** Accepts an A2.2 canonical change result through the same atomic semantic gate. */
export function applyTopologyChangeResult(projectValue, changeResult) {
    if (!changeResult || typeof changeResult !== "object" || !("topology" in changeResult)) {
        throw new ProjectTopologyUpdateError("moveResult", "Topology change result is missing its candidate topology.");
    }
    return applyCanonicalTopologyUpdate(projectValue, changeResult.topology);
}
/**
 * Validates and prepares any canonical topology replacement. A semantic
 * ambiguity returns `remapRequired` without constructing or mutating a project.
 */
export function applyCanonicalTopologyUpdate(projectValue, topologyValue) {
    const project = validateInputProject(projectValue);
    if (project.topology.status !== "active") {
        throw new ProjectTopologyUpdateError("inputProject", "A canonical topology update requires an active project topology.");
    }
    let candidateTopology;
    try {
        candidateTopology = validateTopologyV2(topologyValue, "candidateTopology");
    }
    catch (error) {
        throw updateError("moveResult", `Candidate topology is invalid: ${errorMessage(error)}`, error);
    }
    // Validate all cross-model geometry constraints before attempting semantic
    // reconciliation. The temporary deferred slot avoids validating stale face
    // references against geometry that has not yet been reconciled.
    try {
        validateProjectV2({
            ...structuredClone(project),
            building: { ...project.building, status: "topologyActive" },
            topology: candidateTopology,
            spaces: project.spaces.status === "active"
                ? { status: "deferred", targetStage: "A2", modelVersion: null, data: null }
                : structuredClone(project.spaces),
        });
    }
    catch (error) {
        throw updateError("candidateProject", `Topology cannot be applied to the project: ${errorMessage(error)}`, error);
    }
    let spaces = structuredClone(project.spaces);
    let reconciliation;
    if (project.spaces.status === "active") {
        const result = reconcileSemanticSpaces(project.spaces, project.topology, candidateTopology);
        if (result.status === "remapRequired") {
            return {
                status: "remapRequired",
                candidateTopology: structuredClone(candidateTopology),
                reconciliation: result.report,
            };
        }
        spaces = result.spaces;
        reconciliation = result.report;
    }
    else {
        const previousFaceIds = new Set(extractBoundedFaces(project.topology).faces.map((face) => face.id));
        const candidateFaceIds = extractBoundedFaces(candidateTopology).faces.map((face) => face.id).sort();
        reconciliation = {
            status: "resolved",
            preservedBindings: [],
            reboundBindings: [],
            unresolvedSpaces: [],
            newFaceIds: candidateFaceIds.filter((identity) => !previousFaceIds.has(identity)),
            unclaimedFaceIds: candidateFaceIds,
        };
    }
    const candidate = {
        ...structuredClone(project),
        building: { ...project.building, status: "topologyActive" },
        topology: candidateTopology,
        spaces,
        legacyEditorState: structuredClone(project.legacyEditorState),
    };
    try {
        return { status: "committed", project: validateProjectV2(candidate), reconciliation };
    }
    catch (error) {
        throw updateError("candidateProject", `Topology cannot be applied to the project: ${errorMessage(error)}`, error);
    }
}
function validateInputProject(value) {
    try {
        return validateProjectV2(value);
    }
    catch (error) {
        throw updateError("inputProject", `Input project is invalid: ${errorMessage(error)}`, error);
    }
}
function assertSameEntities(before, after) {
    const beforeNodeIds = Object.keys(before.nodes).sort();
    const afterNodeIds = Object.keys(after.nodes).sort();
    const beforeWallIds = Object.keys(before.walls).sort();
    const afterWallIds = Object.keys(after.walls).sort();
    if (!equalStrings(beforeNodeIds, afterNodeIds) || !equalStrings(beforeWallIds, afterWallIds)) {
        throw new ProjectTopologyUpdateError("moveResult", "A2.5 movement must preserve every canonical node and wall ID.");
    }
    for (const identity of beforeWallIds) {
        const wallId = identity;
        const left = before.walls[wallId];
        const right = after.walls[wallId];
        if (left.id !== right.id ||
            left.startNodeId !== right.startNodeId ||
            left.endNodeId !== right.endNodeId ||
            left.thicknessUm !== right.thicknessUm) {
            throw new ProjectTopologyUpdateError("moveResult", `A2.5 movement cannot replace the identity, connectivity, or thickness of wall ${wallId}.`);
        }
    }
}
function assertNodeChangesMatch(before, after, result) {
    const actualChanges = Object.keys(before.nodes).sort().filter((identity) => {
        const nodeId = identity;
        return before.nodes[nodeId].xUm !== after.nodes[nodeId].xUm || before.nodes[nodeId].yUm !== after.nodes[nodeId].yUm;
    });
    const metadataChanges = [...result.metadata.nodeChanges].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    if (metadataChanges.length !== actualChanges.length) {
        throw new ProjectTopologyUpdateError("moveResult", "Topology move node-change metadata is incomplete.");
    }
    for (let index = 0; index < actualChanges.length; index += 1) {
        const nodeId = actualChanges[index];
        const change = metadataChanges[index];
        const oldNode = before.nodes[nodeId];
        const newNode = after.nodes[nodeId];
        if (change.nodeId !== nodeId ||
            change.before.xUm !== oldNode.xUm ||
            change.before.yUm !== oldNode.yUm ||
            change.after.xUm !== newNode.xUm ||
            change.after.yUm !== newNode.yUm) {
            throw new ProjectTopologyUpdateError("moveResult", `Topology move metadata does not match node ${nodeId}.`);
        }
    }
}
function equalIds(left, right) {
    return left.length === right.length && left.every((identity, index) => identity === right[index]);
}
function equalStrings(left, right) {
    return left.length === right.length && left.every((identity, index) => identity === right[index]);
}
function updateError(stage, message, cause) {
    return new ProjectTopologyUpdateError(stage, message, { cause });
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=topology-update.js.map