import { extractBoundedFaces } from "../spaces/extract-faces.js";
import type { FaceId } from "../spaces/model.js";
import type { NodeId, TopologyV2, WallId } from "../topology/model.js";
import type { TopologyMoveResult } from "../topology/movement.js";
import { validateTopologyV2 } from "../topology/validation.js";
import type { ProjectV2 } from "./schema.js";
import { validateProjectV2 } from "./validation.js";

export type ProjectTopologyUpdateFailureStage =
  | "inputProject"
  | "moveResult"
  | "semanticSpaces"
  | "candidateProject";

export class ProjectTopologyUpdateError extends Error {
  constructor(
    readonly stage: ProjectTopologyUpdateFailureStage,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProjectTopologyUpdateError";
  }
}

/**
 * Atomically accepts an A2.5 movement result as the project's new canonical
 * topology. Legacy rectangles are intentionally untouched reference data.
 */
export function applyTopologyMoveResult(projectValue: ProjectV2, moveResult: TopologyMoveResult): ProjectV2 {
  const project = validateInputProject(projectValue);
  if (project.topology.status !== "active") {
    throw new ProjectTopologyUpdateError("inputProject", "A topology movement requires an active project topology.");
  }
  if (!moveResult || typeof moveResult !== "object" || !moveResult.metadata) {
    throw new ProjectTopologyUpdateError("moveResult", "Topology move result is missing required metadata.");
  }

  let candidateTopology: TopologyV2;
  try {
    candidateTopology = validateTopologyV2(moveResult.topology, "moveResult.topology");
  } catch (error) {
    throw updateError("moveResult", `Topology move result is invalid: ${errorMessage(error)}`, error);
  }

  const beforeFaceIds = extractBoundedFaces(project.topology).faces.map((face) => face.id);
  const afterFaceIds = extractBoundedFaces(candidateTopology).faces.map((face) => face.id);
  if (project.spaces.status === "active") {
    const availableFaceIds = new Set(afterFaceIds);
    const orphaned = project.spaces.spaces.find((space) => !availableFaceIds.has(space.faceId));
    if (orphaned) {
      throw new ProjectTopologyUpdateError(
        "semanticSpaces",
        `Topology move rejected because space ${orphaned.id} would lose bound face ${orphaned.faceId}; automatic remapping is not permitted.`,
      );
    }
  }

  assertSameEntities(project.topology, candidateTopology);
  assertNodeChangesMatch(project.topology, candidateTopology, moveResult);

  const metadataFaceIds = [...moveResult.metadata.preservedFaceIds];
  const metadataMatches =
    moveResult.metadata.faceCountBefore === beforeFaceIds.length &&
    moveResult.metadata.faceCountAfter === afterFaceIds.length &&
    equalIds(metadataFaceIds, beforeFaceIds);
  if (!metadataMatches) {
    throw new ProjectTopologyUpdateError("moveResult", "Topology move metadata does not match the current project faces.");
  }
  if (!equalIds(beforeFaceIds, afterFaceIds)) {
    const stage = project.spaces.status === "active" ? "semanticSpaces" : "moveResult";
    throw new ProjectTopologyUpdateError(
      stage,
      project.spaces.status === "active"
        ? "Topology move rejected because bound face identities changed; semantic space remapping must be explicit."
        : "Topology move rejected because derived face identities changed.",
    );
  }

  const candidate: ProjectV2 = {
    ...structuredClone(project),
    building: { ...project.building, status: "topologyActive" },
    topology: candidateTopology,
    spaces: structuredClone(project.spaces),
    legacyEditorState: structuredClone(project.legacyEditorState),
  };
  try {
    return validateProjectV2(candidate);
  } catch (error) {
    throw updateError("candidateProject", `Topology move cannot be applied to the project: ${errorMessage(error)}`, error);
  }
}

function validateInputProject(value: ProjectV2): ProjectV2 {
  try {
    return validateProjectV2(value);
  } catch (error) {
    throw updateError("inputProject", `Input project is invalid: ${errorMessage(error)}`, error);
  }
}

function assertSameEntities(before: TopologyV2, after: TopologyV2): void {
  const beforeNodeIds = Object.keys(before.nodes).sort();
  const afterNodeIds = Object.keys(after.nodes).sort();
  const beforeWallIds = Object.keys(before.walls).sort();
  const afterWallIds = Object.keys(after.walls).sort();
  if (!equalStrings(beforeNodeIds, afterNodeIds) || !equalStrings(beforeWallIds, afterWallIds)) {
    throw new ProjectTopologyUpdateError("moveResult", "A2.5 movement must preserve every canonical node and wall ID.");
  }
  for (const identity of beforeWallIds) {
    const wallId = identity as WallId;
    const left = before.walls[wallId]!;
    const right = after.walls[wallId]!;
    if (
      left.id !== right.id ||
      left.startNodeId !== right.startNodeId ||
      left.endNodeId !== right.endNodeId ||
      left.thicknessUm !== right.thicknessUm
    ) {
      throw new ProjectTopologyUpdateError(
        "moveResult",
        `A2.5 movement cannot replace the identity, connectivity, or thickness of wall ${wallId}.`,
      );
    }
  }
}

function assertNodeChangesMatch(before: TopologyV2, after: TopologyV2, result: TopologyMoveResult): void {
  const actualChanges = Object.keys(before.nodes).sort().filter((identity) => {
    const nodeId = identity as NodeId;
    return before.nodes[nodeId]!.xUm !== after.nodes[nodeId]!.xUm || before.nodes[nodeId]!.yUm !== after.nodes[nodeId]!.yUm;
  });
  const metadataChanges = [...result.metadata.nodeChanges].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  if (metadataChanges.length !== actualChanges.length) {
    throw new ProjectTopologyUpdateError("moveResult", "Topology move node-change metadata is incomplete.");
  }
  for (let index = 0; index < actualChanges.length; index += 1) {
    const nodeId = actualChanges[index] as NodeId;
    const change = metadataChanges[index]!;
    const oldNode = before.nodes[nodeId]!;
    const newNode = after.nodes[nodeId]!;
    if (
      change.nodeId !== nodeId ||
      change.before.xUm !== oldNode.xUm ||
      change.before.yUm !== oldNode.yUm ||
      change.after.xUm !== newNode.xUm ||
      change.after.yUm !== newNode.yUm
    ) {
      throw new ProjectTopologyUpdateError("moveResult", `Topology move metadata does not match node ${nodeId}.`);
    }
  }
}

function equalIds(left: readonly FaceId[], right: readonly FaceId[]): boolean {
  return left.length === right.length && left.every((identity, index) => identity === right[index]);
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((identity, index) => identity === right[index]);
}

function updateError(
  stage: ProjectTopologyUpdateFailureStage,
  message: string,
  cause: unknown,
): ProjectTopologyUpdateError {
  return new ProjectTopologyUpdateError(stage, message, { cause });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
