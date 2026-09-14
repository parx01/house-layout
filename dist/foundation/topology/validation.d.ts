import { type TopologyV2 } from "./model.js";
export declare class TopologyValidationError extends Error {
    constructor(message: string);
}
export declare function validateTopologyV2(value: unknown, path?: string): TopologyV2;
//# sourceMappingURL=validation.d.ts.map