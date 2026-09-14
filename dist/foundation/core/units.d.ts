declare const lengthUmBrand: unique symbol;
declare const coordinateUmBrand: unique symbol;
declare const areaUm2Brand: unique symbol;
export type LengthUm = number & {
    readonly [lengthUmBrand]: "LengthUm";
};
export type CoordinateUm = number & {
    readonly [coordinateUmBrand]: "CoordinateUm";
};
export type AreaUm2 = number & {
    readonly [areaUm2Brand]: "AreaUm2";
};
export declare const UM_PER_MM = 1000;
export declare const UM_PER_INCH = 25400;
export declare const UM_PER_FOOT = 304800;
export declare const UM2_PER_SQ_FOOT: number;
export declare function lengthUm(value: number, label?: string): LengthUm;
export declare function positiveLengthUm(value: number, label?: string): LengthUm;
export declare function coordinateUm(value: number, label?: string): CoordinateUm;
export declare function areaUm2(value: number, label?: string): AreaUm2;
export declare function inches(value: number): LengthUm;
export declare function feet(value: number): LengthUm;
export declare function feetAndInches(feetValue: number, inchesValue?: number): LengthUm;
export interface ParseLengthOptions {
    allowZero?: boolean;
}
/**
 * Accepted grammar:
 * - architectural: 10', 10'6", 10' 6", 9'3"
 * - plain inches: 18", 18 in, 18 inches
 * - compatibility decimal feet: 49.1666667, 49.1666667 ft
 */
export declare function parseArchitecturalLength(input: string, options?: ParseLengthOptions): LengthUm;
export declare function formatArchitecturalLength(value: LengthUm): string;
export declare function decimalFeetToLength(value: number): LengthUm;
export declare function lengthToDecimalFeet(value: LengthUm): number;
export declare function areaToSquareFeet(value: AreaUm2): number;
export declare function formatSquareFeet(value: AreaUm2, decimals?: number): string;
export declare function umToLegacyMm(value: LengthUm): number;
export declare function legacyMmToUm(value: number): LengthUm;
export {};
//# sourceMappingURL=units.d.ts.map