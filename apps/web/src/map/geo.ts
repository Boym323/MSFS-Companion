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

/** The whole flight trace is projected only when a point or the zoom changes.
 * Each segment follows the shortest wrapped longitude, including the dateline.
 * Coordinates are relative to the first point so recentering only translates
 * the existing SVG path instead of rebuilding thousands of coordinates.
 */
export function relativeTrackPath(points: readonly Point[], zoom: number): string {
  if (points.length < 2) return '';
  const first = project(points[0], zoom);
  let previous = first;
  let offsetX = 0;
  const commands = ['M 0 0'];
  for (let i = 1; i < points.length; i++) {
    const current = project(points[i], zoom);
    offsetX += shortestWorldDistance(current.x, previous.x, zoom);
    commands.push(`L ${offsetX.toFixed(1)} ${(current.y - first.y).toFixed(1)}`);
    previous = current;
  }
  return commands.join(' ');
}

export function trackPathOrigin(
  first: Point, center: WorldPoint, zoom: number, width: number, height: number,
): WorldPoint {
  const projected = project(first, zoom);
  return {
    x: shortestWorldDistance(projected.x, center.x, zoom) + width / 2,
    y: projected.y - center.y + height / 2,
  };
}

export type WorldPoint = { x: number; y: number };

export type VisibleTile = {
  key: string;
  url: string;
  left: number;
  top: number;
};

/** Jen dlaždice viditelného výřezu; žádný prefetch ani hromadné stahování. */
export function visibleTiles(center: WorldPoint, zoom: number, width: number, height: number): VisibleTile[] {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 18
    || !Number.isFinite(center.x) || !Number.isFinite(center.y)
    || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const x1 = Math.floor((center.x - width / 2) / TILE_SIZE);
  const x2 = Math.floor((center.x + width / 2) / TILE_SIZE);
  const y1 = Math.floor((center.y - height / 2) / TILE_SIZE);
  const y2 = Math.floor((center.y + height / 2) / TILE_SIZE);
  const max = 2 ** zoom;
  const result: VisibleTile[] = [];
  // Ochrana proti nečekaně obrovskému viewportu a zatížení veřejného OSM serveru.
  if ((x2 - x1 + 1) * (y2 - y1 + 1) > 64) return [];
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      if (y < 0 || y >= max) continue;
      result.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapTileX(x, zoom)}/${y}.png`,
        left: x * TILE_SIZE - center.x + width / 2,
        top: y * TILE_SIZE - center.y + height / 2,
      });
    }
  }
  return result;
}
