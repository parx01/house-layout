declare const lengthUmBrand: unique symbol;
declare const coordinateUmBrand: unique symbol;
declare const areaUm2Brand: unique symbol;

export type LengthUm = number & { readonly [lengthUmBrand]: "LengthUm" };
export type CoordinateUm = number & { readonly [coordinateUmBrand]: "CoordinateUm" };
export type AreaUm2 = number & { readonly [areaUm2Brand]: "AreaUm2" };

export const UM_PER_MM = 1_000;
export const UM_PER_INCH = 25_400;
export const UM_PER_FOOT = 304_800;
export const UM2_PER_SQ_FOOT = UM_PER_FOOT * UM_PER_FOOT;

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
  return value;
}

export function lengthUm(value: number, label = "length"): LengthUm {
  requireSafeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} cannot be negative.`);
  return value as LengthUm;
}

export function positiveLengthUm(value: number, label = "dimension"): LengthUm {
  const result = lengthUm(value, label);
  if (result === 0) throw new RangeError(`${label} must be greater than zero.`);
  return result;
}

export function coordinateUm(value: number, label = "coordinate"): CoordinateUm {
  return requireSafeInteger(value, label) as CoordinateUm;
}

export function areaUm2(value: number, label = "area"): AreaUm2 {
  requireSafeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} cannot be negative.`);
  return value as AreaUm2;
}

export function inches(value: number): LengthUm {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("Inches must be a non-negative whole number.");
  }
  return lengthUm(value * UM_PER_INCH);
}

export function feet(value: number): LengthUm {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("Feet must be a non-negative whole number.");
  }
  return lengthUm(value * UM_PER_FOOT);
}

export function feetAndInches(feetValue: number, inchesValue = 0): LengthUm {
  if (!Number.isInteger(feetValue) || feetValue < 0) {
    throw new RangeError("Feet must be a non-negative whole number.");
  }
  if (!Number.isInteger(inchesValue) || inchesValue < 0 || inchesValue >= 12) {
    throw new RangeError("Inches must be a whole number from 0 through 11.");
  }
  return lengthUm(feetValue * UM_PER_FOOT + inchesValue * UM_PER_INCH);
}

export interface ParseLengthOptions {
  allowZero?: boolean;
}

/**
 * Accepted grammar:
 * - architectural: 10', 10'6", 10' 6", 9'3"
 * - plain inches: 18", 18 in, 18 inches
 * - compatibility decimal feet: 49.1666667, 49.1666667 ft
 */
export function parseArchitecturalLength(input: string, options: ParseLengthOptions = {}): LengthUm {
  const text = input.trim();
  if (!text) throw new Error("Dimension is required.");

  const architectural = /^(\d+)\s*'\s*(?:(\d+)\s*(?:\"|in(?:ch(?:es)?)?)?)?$/i.exec(text);
  if (architectural) {
    const footPart = Number(architectural[1]);
    const inchPart = Number(architectural[2] ?? 0);
    if (inchPart >= 12) throw new Error("Inches after feet must be between 0 and 11.");
    return requireAllowedZero(feetAndInches(footPart, inchPart), options);
  }

  const plainInches = /^(\d+)\s*(?:\"|in(?:ch(?:es)?)?)$/i.exec(text);
  if (plainInches) {
    return requireAllowedZero(inches(Number(plainInches[1])), options);
  }

  const decimalFeet = /^(\d+(?:\.\d+)?)\s*(?:ft|feet)?$/i.exec(text);
  if (decimalFeet) {
    const value = Number(decimalFeet[1]);
    if (!Number.isFinite(value)) throw new Error("Dimension is not finite.");
    return requireAllowedZero(lengthUm(Math.round(value * UM_PER_FOOT)), options);
  }

  throw new Error(`Invalid dimension: "${input}".`);
}

function requireAllowedZero(value: LengthUm, options: ParseLengthOptions): LengthUm {
  if (value === 0 && options.allowZero !== true) {
    throw new Error("Dimension must be greater than zero.");
  }
  return value;
}

export function formatArchitecturalLength(value: LengthUm): string {
  const roundedInches = Math.round(value / UM_PER_INCH);
  const wholeFeet = Math.floor(roundedInches / 12);
  const remainingInches = roundedInches % 12;
  return remainingInches === 0 ? `${wholeFeet}'` : `${wholeFeet}'${remainingInches}\"`;
}

export function decimalFeetToLength(value: number): LengthUm {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError("Decimal feet must be a positive finite number.");
  }
  return positiveLengthUm(Math.round(value * UM_PER_FOOT));
}

export function lengthToDecimalFeet(value: LengthUm): number {
  return value / UM_PER_FOOT;
}

export function areaToSquareFeet(value: AreaUm2): number {
  return value / UM2_PER_SQ_FOOT;
}

export function formatSquareFeet(value: AreaUm2, decimals = 4): string {
  return `${areaToSquareFeet(value).toFixed(decimals)} sq ft`;
}

export function umToLegacyMm(value: LengthUm): number {
  return value / UM_PER_MM;
}

export function legacyMmToUm(value: number): LengthUm {
  if (!Number.isFinite(value) || value < 0) throw new RangeError("Legacy millimetres must be non-negative.");
  return lengthUm(Math.round(value * UM_PER_MM));
}
