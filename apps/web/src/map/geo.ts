export type Point = { latitude: number; longitude: number };
export const TILE_SIZE = 256;
const MAX_LAT = 85.05112878;

export function project(point: Point, zoom: number) {
  const lat = Math.min(MAX_LAT, Math.max(-MAX_LAT, point.latitude));
  const n = TILE_SIZE * 2 ** zoom;
  const radians = (lat * Math.PI) / 180;
  return {
    x: ((point.longitude + 180) / 360) * n,
    y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n,
  };
}

export function wrapTileX(x: number, zoom: number) {
  const n = 2 ** zoom;
  return ((x % n) + n) % n;
}

export function shortestWorldDistance(x: number, centerX: number, zoom: number) {
  const world = TILE_SIZE * 2 ** zoom;
  return ((x - centerX + world * 1.5) % world) - world / 2;
}

export function metersBetween(a: Point, b: Point) {
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
