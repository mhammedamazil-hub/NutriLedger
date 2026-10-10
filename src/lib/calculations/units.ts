/**
 * Unit conversions. Internal storage is always metric (kg, cm); these helpers
 * are used only at the input/display boundary. Exact international
 * definitions are used so round trips don't drift:
 *   1 lb = 0.45359237 kg (exact), 1 in = 2.54 cm (exact).
 */
export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const cmToIn = (cm: number): number => cm / CM_PER_INCH;
export const inToCm = (inches: number): number => inches * CM_PER_INCH;

/** Splits centimetres into whole feet and remaining inches (inches may be fractional). */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToIn(cm);
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = totalInches - feet * INCHES_PER_FOOT;
  // Rounding display to 1 decimal could produce 12.0 in; normalise that case.
  if (Math.round(inches * 10) / 10 >= INCHES_PER_FOOT) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export const feetInchesToCm = (feet: number, inches: number): number =>
  inToCm(feet * INCHES_PER_FOOT + inches);
