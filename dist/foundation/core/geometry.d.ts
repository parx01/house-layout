import { type AreaUm2, type CoordinateUm, type LengthUm } from "./units.js";
export interface PointUm {
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
}
export interface RectUm {
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
    readonly widthUm: LengthUm;
    readonly depthUm: LengthUm;
}
export declare function pointUm(xUm: number, yUm: number): PointUm;
export declare function rectUm(xUm: number, yUm: number, widthUm: number, depthUm: number): RectUm;
export declare function rectArea(rectangle: RectUm): AreaUm2;
export declare function rectRight(rectangle: RectUm): CoordinateUm;
export declare function rectFront(rectangle: RectUm): CoordinateUm;
//# sourceMappingURL=geometry.d.ts.map