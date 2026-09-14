export const UM_PER_MM = 1_000;
export const UM_PER_INCH = 25_400;
export const UM_PER_FOOT = 304_800;
export const UM2_PER_SQ_FOOT = UM_PER_FOOT * UM_PER_FOOT;
function requireSafeInteger(value, label) {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError(`${label} must be a safe integer.`);
    }
    return value;
}
export function lengthUm(value, label = "length") {
    requireSafeInteger(value, label);
    if (value < 0)
        throw new RangeError(`${label} cannot be negative.`);
    return value;
}
export function positiveLengthUm(value, label = "dimension") {
    const result = lengthUm(value, label);
    if (result === 0)
        throw new RangeError(`${label} must be greater than zero.`);
    return result;
}
export function coordinateUm(value, label = "coordinate") {
    return requireSafeInteger(value, label);
}
export function areaUm2(value, label = "area") {
    requireSafeInteger(value, label);
    if (value < 0)
        throw new RangeError(`${label} cannot be negative.`);
    return value;
}
export function inches(value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError("Inches must be a non-negative whole number.");
    }
    return lengthUm(value * UM_PER_INCH);
}
export function feet(value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError("Feet must be a non-negative whole number.");
    }
    return lengthUm(value * UM_PER_FOOT);
}
export function feetAndInches(feetValue, inchesValue = 0) {
    if (!Number.isInteger(feetValue) || feetValue < 0) {
        throw new RangeError("Feet must be a non-negative whole number.");
    }
    if (!Number.isInteger(inchesValue) || inchesValue < 0 || inchesValue >= 12) {
        throw new RangeError("Inches must be a whole number from 0 through 11.");
    }
    return lengthUm(feetValue * UM_PER_FOOT + inchesValue * UM_PER_INCH);
}
/**
 * Accepted grammar:
 * - architectural: 10', 10'6", 10' 6", 9'3"
 * - plain inches: 18", 18 in, 18 inches
 * - compatibility decimal feet: 49.1666667, 49.1666667 ft
 */
export function parseArchitecturalLength(input, options = {}) {
    const text = input.trim();
    if (!text)
        throw new Error("Dimension is required.");
    const architectural = /^(\d+)\s*'\s*(?:(\d+)\s*(?:\"|in(?:ch(?:es)?)?)?)?$/i.exec(text);
    if (architectural) {
        const footPart = Number(architectural[1]);
        const inchPart = Number(architectural[2] ?? 0);
        if (inchPart >= 12)
            throw new Error("Inches after feet must be between 0 and 11.");
        return requireAllowedZero(feetAndInches(footPart, inchPart), options);
    }
    const plainInches = /^(\d+)\s*(?:\"|in(?:ch(?:es)?)?)$/i.exec(text);
    if (plainInches) {
        return requireAllowedZero(inches(Number(plainInches[1])), options);
    }
    const decimalFeet = /^(\d+(?:\.\d+)?)\s*(?:ft|feet)?$/i.exec(text);
    if (decimalFeet) {
        const value = Number(decimalFeet[1]);
        if (!Number.isFinite(value))
            throw new Error("Dimension is not finite.");
        return requireAllowedZero(lengthUm(Math.round(value * UM_PER_FOOT)), options);
    }
    throw new Error(`Invalid dimension: "${input}".`);
}
function requireAllowedZero(value, options) {
    if (value === 0 && options.allowZero !== true) {
        throw new Error("Dimension must be greater than zero.");
    }
    return value;
}
export function formatArchitecturalLength(value) {
    const roundedInches = Math.round(value / UM_PER_INCH);
    const wholeFeet = Math.floor(roundedInches / 12);
    const remainingInches = roundedInches % 12;
    return remainingInches === 0 ? `${wholeFeet}'` : `${wholeFeet}'${remainingInches}\"`;
}
export function decimalFeetToLength(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError("Decimal feet must be a positive finite number.");
    }
    return positiveLengthUm(Math.round(value * UM_PER_FOOT));
}
export function lengthToDecimalFeet(value) {
    return value / UM_PER_FOOT;
}
export function areaToSquareFeet(value) {
    return value / UM2_PER_SQ_FOOT;
}
export function formatSquareFeet(value, decimals = 4) {
    return `${areaToSquareFeet(value).toFixed(decimals)} sq ft`;
}
export function umToLegacyMm(value) {
    return value / UM_PER_MM;
}
export function legacyMmToUm(value) {
    if (!Number.isFinite(value) || value < 0)
        throw new RangeError("Legacy millimetres must be non-negative.");
    return lengthUm(Math.round(value * UM_PER_MM));
}
//# sourceMappingURL=units.js.map