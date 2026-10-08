import { normalizeHeading } from './math';

export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

export const PFD_LAYOUT = {
  width: 1000,
  height: 590,
  centerX: 479,
  centerY: 255,
  horizon: { x: 208, y: 52, width: 542, height: 402 },
  speed: { x: 24, y: 99, width: 176, height: 326 },
  altitude: { x: 760, y: 99, width: 136, height: 326 },
  vsi: { x: 907, y: 99, width: 78, height: 326 },
  compass: { x: 208, y: 474, width: 542, height: 102 },
  compassTicks: { x: 214, y: 483, width: 530, height: 44 },
  pointerTop: 233,
  pointerBottom: 277,
} as const;

// Stupnice před a za aktuální hodnotou, ale NIKDY duplicitní nuly při IAS 0.
export function tapeTicks(value: number, step: number, radius = 8, minimum = -Infinity): number[] {
  if (!Number.isFinite(value) || !(step > 0)) return [];
  const base = Math.round(value / step) * step;
  const result: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    const mark = Math.round((base + i * step) * 1e6) / 1e6;
    if (mark >= minimum) result.push(mark);
  }
  return result;
}

export function tapeY(mark: number, current: number, pixelsPerUnit: number): number {
  return PFD_LAYOUT.centerY - (mark - current) * pixelsPerUnit;
}

/** Horní a dolní výřez čísel: pod neprůhledným kurzorem se nikdy neobjeví text. */
export function tapeScaleClips(rect: Rect): [Rect, Rect] {
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: PFD_LAYOUT.pointerTop - rect.y },
    { x: rect.x, y: PFD_LAYOUT.pointerBottom, width: rect.width,
      height: rect.y + rect.height - PFD_LAYOUT.pointerBottom },
  ];
}

export function compassMarks(heading: number): Array<{ key: number; value: number; x: number }> {
  const base = Math.round(heading / 10) * 10;
  return Array.from({ length: 17 }, (_, i) => {
    const key = base + (i - 8) * 10;
    return {
      key,
      value: normalizeHeading(key),
      x: PFD_LAYOUT.centerX + (key - heading) * 4.75,
    };
  });
}

export function vsNeedleY(vsFpm: number): number {
  return PFD_LAYOUT.centerY - Math.max(-3000, Math.min(3000, vsFpm)) * 0.043;
}

export function compassLabel(degrees: number): string {
  if (degrees === 0) return 'S';
  if (degrees === 90) return 'V';
  if (degrees === 180) return 'J';
  if (degrees === 270) return 'Z';
  return Math.round(degrees).toString();
}
