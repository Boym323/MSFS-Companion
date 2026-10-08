import {
  project, shortestWorldDistance, TILE_SIZE, type Point, type WorldPoint,
} from './geo.ts';

export type RouteView = { zoom: number; center: WorldPoint };
const WORLD = TILE_SIZE;
const valid = (point: Point) => Number.isFinite(point.latitude)
  && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 85.05112878
  && Math.abs(point.longitude) <= 180;

/** Mercator výřez přizpůsobený celé trase včetně přeletů datové hranice ±180°. */
export function fitRoute(points: readonly Point[], width: number, height: number): RouteView | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const normalized = points.filter(valid).map(p => project(p, 0));
  if (normalized.length === 0) return null;

  const xs = normalized.map(p => p.x).sort((a, b) => a - b);
  let largestGap = -1;
  let first = xs[0];
  for (let i = 0; i < xs.length; i++) {
    const next = i + 1 === xs.length ? xs[0] + WORLD : xs[i + 1];
    const gap = next - xs[i];
    if (gap > largestGap) { largestGap = gap; first = next % WORLD; }
  }
  const spanX = WORLD - largestGap;
  const minY = Math.min(...normalized.map(p => p.y));
  const maxY = Math.max(...normalized.map(p => p.y));
  const spanY = maxY - minY;
  const usableWidth = Math.max(1, width - 56);
  const usableHeight = Math.max(1, height - 56);
  let zoom = 2;
  for (let candidate = 14; candidate >= 2; candidate--) {
    const factor = 2 ** candidate;
    if (spanX * factor <= usableWidth && spanY * factor <= usableHeight) {
      zoom = candidate;
      break;
    }
  }
  const scale = 2 ** zoom;
  return { zoom, center: { x: ((first + spanX / 2) % WORLD) * scale,
    y: (minY + maxY) / 2 * scale } };
}

export function pointOnRouteMap(point: Point, view: RouteView, width: number, height: number) {
  if (!valid(point)) return null;
  const world = project(point, view.zoom);
  return {
    x: shortestWorldDistance(world.x, view.center.x, view.zoom) + width / 2,
    y: world.y - view.center.y + height / 2,
  };
}
