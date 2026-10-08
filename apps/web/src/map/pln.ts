export type ImportedWaypoint = { id: string; latitude: number; longitude: number };

function dms(part: string, axis: 'latitude' | 'longitude'): number | null {
  const match = part.trim().match(/^([NSEW])\s*(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"/i);
  if (!match) return null;
  const hemisphere = match[1].toUpperCase();
  if ((axis === 'latitude' && !['N', 'S'].includes(hemisphere))
    || (axis === 'longitude' && !['E', 'W'].includes(hemisphere))) return null;
  const degrees = Number(match[2]), minutes = Number(match[3]), seconds = Number(match[4]);
  const limit = axis === 'latitude' ? 90 : 180;
  if (degrees > limit || minutes >= 60 || seconds >= 60 ||
      (degrees === limit && (minutes !== 0 || seconds !== 0))) return null;
  const value = degrees + minutes / 60 + seconds / 3600;
  return ['S', 'W'].includes(hemisphere) ? -value : value;
}

/** MSFS PLN WorldPosition: N50° 6' 3.41",E14° 15' 36.84",+001245.00 */
export function parseWorldPosition(value: string): { latitude: number; longitude: number } | null {
  const [latitudePart, longitudePart] = value.split(',');
  if (!latitudePart || !longitudePart) return null;
  const latitude = dms(latitudePart, 'latitude');
  const longitude = dms(longitudePart, 'longitude');
  return latitude !== null && longitude !== null && Math.abs(latitude) <= 85.05
    ? { latitude, longitude } : null;
}

/** Lokální import PLN bez odesílání souboru na bridge nebo internet. */
export function parsePln(xml: string): ImportedWaypoint[] {
  if (xml.length > 2_000_000) throw new Error('PLN soubor je příliš velký.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Neplatný XML soubor.');
  const nodes = Array.from(document.querySelectorAll('ATCWaypoint'));
  if (nodes.length < 1 || nodes.length > 200) throw new Error('Nepodporovaný počet waypointů.');
  const points: ImportedWaypoint[] = [];
  for (const node of nodes) {
    const pos = parseWorldPosition(node.querySelector('WorldPosition')?.textContent ?? '');
    if (!pos) continue;
    const rawId = node.getAttribute('id') ?? 'WAYPOINT';
    const id = /^[\w -]{1,32}$/.test(rawId) ? rawId : 'WAYPOINT';
    points.push({ id, ...pos });
  }
  if (points.length < 2) throw new Error('Flight plan nemá alespoň dva platné body.');
  return points;
}
