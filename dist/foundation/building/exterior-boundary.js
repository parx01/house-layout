import { extractBoundedFaces } from "../spaces/extract-faces.js";
import { validateTopologyV2 } from "../topology/validation.js";
export class ExteriorBoundaryDerivationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExteriorBoundaryDerivationError";
    }
}
/**
 * Purely derives the building-to-unbounded-plane boundary from canonical
 * topology and A2.4 face incidence. No semantic or legacy geometry is read.
 */
export function deriveExteriorBoundary(topologyValue) {
    const topology = validateTopologyV2(topologyValue, "exteriorBoundary.topology");
    const faceSet = extractBoundedFaces(topology);
    const incidences = new Map();
    for (const face of faceSet.faces) {
        for (let index = 0; index < face.boundary.length; index += 1) {
            const reference = face.boundary[index];
            const start = face.vertices[index];
            const end = face.vertices[(index + 1) % face.vertices.length];
            const values = incidences.get(reference.wallId) ?? [];
            values.push({
                ...reference,
                key: halfEdgeKey(reference),
                faceId: face.id,
                startNodeId: start.nodeId,
                endNodeId: end.nodeId,
            });
            incidences.set(reference.wallId, values);
        }
    }
    const exteriorEdges = [];
    const exteriorWallIds = [];
    const internalSharedWallIds = [];
    const nonFaceBoundaryWallIds = [];
    for (const wallIdentity of Object.keys(topology.walls).sort()) {
        const uses = incidences.get(wallIdentity) ?? [];
        if (uses.length === 0) {
            nonFaceBoundaryWallIds.push(wallIdentity);
            continue;
        }
        if (uses.length === 1) {
            exteriorWallIds.push(wallIdentity);
            exteriorEdges.push(uses[0]);
            continue;
        }
        if (uses.length === 2) {
            if (uses[0].direction === uses[1].direction) {
                throw new ExteriorBoundaryDerivationError(`Internal wall ${wallIdentity} is not used in opposite directions by its bounded faces.`);
            }
            internalSharedWallIds.push(wallIdentity);
            continue;
        }
        throw new ExteriorBoundaryDerivationError(`Canonical wall ${wallIdentity} is incident to more than two bounded faces.`);
    }
    return {
        modelVersion: 1,
        topologyModelVersion: 1,
        exteriorWallIds,
        internalSharedWallIds,
        nonFaceBoundaryWallIds,
        loops: assembleExteriorLoops(topology, exteriorEdges),
    };
}
function assembleExteriorLoops(topology, edges) {
    const outgoing = new Map();
    const incoming = new Map();
    for (const edge of edges) {
        const outgoingValues = outgoing.get(edge.startNodeId) ?? [];
        outgoingValues.push(edge);
        outgoing.set(edge.startNodeId, outgoingValues);
        const incomingValues = incoming.get(edge.endNodeId) ?? [];
        incomingValues.push(edge);
        incoming.set(edge.endNodeId, incomingValues);
    }
    const boundaryNodeIds = new Set([...outgoing.keys(), ...incoming.keys()]);
    for (const nodeIdentity of [...boundaryNodeIds].sort()) {
        const outgoingCount = outgoing.get(nodeIdentity)?.length ?? 0;
        const incomingCount = incoming.get(nodeIdentity)?.length ?? 0;
        if (outgoingCount !== 1 || incomingCount !== 1) {
            throw new ExteriorBoundaryDerivationError(`Exterior boundary is non-manifold at node ${nodeIdentity}: ${incomingCount} incoming, ${outgoingCount} outgoing.`);
        }
    }
    const byKey = new Map(edges.map((edge) => [edge.key, edge]));
    const visited = new Set();
    const loops = [];
    for (const initial of [...edges].sort(compareEdges)) {
        if (visited.has(initial.key))
            continue;
        const walk = [];
        let current = initial;
        while (!visited.has(current.key)) {
            visited.add(current.key);
            walk.push(current);
            const next = outgoing.get(current.endNodeId)?.[0];
            if (!next || !byKey.has(next.key)) {
                throw new ExteriorBoundaryDerivationError(`Exterior half-edge ${current.key} does not continue to a closed loop.`);
            }
            current = next;
        }
        if (current.key !== initial.key) {
            throw new ExteriorBoundaryDerivationError(`Exterior walk beginning ${initial.key} merged into another loop.`);
        }
        const canonical = rotateToCanonicalStart(walk);
        const signature = canonical.map((edge) => edge.key).join("|");
        loops.push({
            signature,
            loop: {
                winding: "clockwise",
                boundary: canonical.map(({ wallId, direction }) => ({ wallId, direction })),
                vertices: canonical.map((edge) => {
                    const node = topology.nodes[edge.startNodeId];
                    return { nodeId: node.id, xUm: node.xUm, yUm: node.yUm };
                }),
            },
        });
    }
    if (visited.size !== edges.length) {
        throw new ExteriorBoundaryDerivationError("Not every exterior half-edge was assigned to a boundary loop.");
    }
    return loops.sort((left, right) => left.signature.localeCompare(right.signature)).map(({ loop }) => loop);
}
function rotateToCanonicalStart(edges) {
    let bestIndex = 0;
    for (let index = 1; index < edges.length; index += 1) {
        if (edges[index].key.localeCompare(edges[bestIndex].key) < 0)
            bestIndex = index;
    }
    return [...edges.slice(bestIndex), ...edges.slice(0, bestIndex)];
}
function halfEdgeKey(reference) {
    return `${reference.wallId}:${reference.direction === "forward" ? "f" : "r"}`;
}
function compareEdges(left, right) {
    return left.key.localeCompare(right.key);
}
//# sourceMappingURL=exterior-boundary.js.map