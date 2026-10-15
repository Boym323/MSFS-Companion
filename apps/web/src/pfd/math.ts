/** Normalizace leteckého kurzu, aby hodnoty zůstaly v intervalu [0, 360). */
export function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Nejkratší úhlový rozdíl - přechod 359° na 1° netočí přes celý kruh. */
export function shortestAngleDifference(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Exponenciální vyhlazení nezávislé na FPS pro vykreslování, nikoli telemetrii. */
export function blend(value: number, target: number, elapsedMs: number): number {
  const alpha = 1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 100)) / 95);
  return value + (target - value) * alpha;
}

export function blendAngle(value: number, target: number, elapsedMs: number): number {
  return normalizeHeading(value + shortestAngleDifference(value, target)
    * (1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 100)) / 95)));
}

/** SimConnect: kladný pitch = příď dolů; pro PFD je kladný = příď nahoru. */
export function pitchUpFromSimConnect(pitchDegrees: number): number {
  return -pitchDegrees;
}

/** SimConnect: kladný bank = levé křídlo dolů; PFD kreslí rotaci horizontu opačně vůči letadlu. */
export function bankHorizonRotation(bankDegrees: number): number {
  return bankDegrees;
}

/** Skip React commits once interpolation is visually indistinguishable from
 * the last displayed frame. This does not alter raw SimConnect telemetry.
 * Angular differences must wrap correctly at north and at +/-180 bank.
 */
export type PfdFlightNumbers = {
  speed: number; altitude: number; vs: number;
  heading: number; pitch: number; bank: number;
};

export function sameDisplayFrame(a: PfdFlightNumbers, b: PfdFlightNumbers): boolean {
  return Math.abs(a.speed - b.speed) < 0.025
    && Math.abs(a.altitude - b.altitude) < 0.05
    && Math.abs(a.vs - b.vs) < 0.5
    && Math.abs(shortestAngleDifference(a.heading, b.heading)) < 0.025
    && Math.abs(a.pitch - b.pitch) < 0.01
    && Math.abs(shortestAngleDifference(a.bank, b.bank)) < 0.01;
}
