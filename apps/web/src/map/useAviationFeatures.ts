import { useEffect, useState } from 'react';

export type AviationFeature = {
  type: 'airport' | 'vor' | 'ndb' | 'dme' | 'runway';
  ident: string; name: string; latitude: number; longitude: number;
  endLatitude?: number | null; endLongitude?: number | null;
  airportIdent?: string | null; lengthFeet?: number | null;
  surface?: string | null; frequencyKhz?: number | null;
};
export type AviationStatus = {
  available: boolean; loading: boolean; stale: boolean; source: string;
  updatedAt: string | null; error: string | null; features: AviationFeature[];
};
export type AirportDetail = {
  airport: { ident: string; name: string; airportType: string;
    latitude: number; longitude: number; elevationFeet: number | null };
  runways: { lowIdent: string; highIdent: string; lengthFeet: number | null;
    surface: string }[];
  frequencies: { type: string; description: string; frequencyMhz: number }[];
  source: string; updatedAt: string;
};

const empty: AviationStatus = {
  available: false, loading: false, stale: false, source: 'OurAirports',
  updatedAt: null, error: null, features: [],
};

/** Dotazy posíláme na vlastní bridge. Prohlížeč nikdy nestahuje celé CSV. */
export function useAviationFeatures(
  enabled: boolean, latitude: number | null, longitude: number | null, zoom: number,
): AviationStatus {
  const [result, setResult] = useState<AviationStatus>(empty);
  const lat = latitude === null || !Number.isFinite(latitude) ? null : Math.round(latitude * 2) / 2;
  const lon = longitude === null || !Number.isFinite(longitude) ? null : Math.round(longitude * 2) / 2;
  const radiusKm = Math.max(20, Math.min(200, Math.round(95 * 2 ** (11 - zoom))));
  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      setResult(empty); return;
    }
    let stopped = false;
    let timeout: number | undefined;
    const controller = new AbortController();
    const load = async () => {
      let interval = 35000;
      try {
        const query = new URLSearchParams({
          lat: String(lat), lon: String(lon), radiusKm: String(radiusKm),
        });
        const response = await fetch('/api/map/aviation?' + query.toString(),
          { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Letecká data nelze načíst.');
        const data = await response.json() as AviationStatus;
        if (!stopped) {
          setResult({ ...data, features: data.available ? (data.features ?? []) : [] });
          if (data.loading || !data.available) interval = data.loading ? 5000 : 30000;
        }
      } catch {
        if (!stopped) {
          setResult(before => ({ ...before, loading: false,
            error: 'Bridge není dostupný.', available: before.available }));
          interval = 30000;
        }
      } finally {
        if (!stopped) timeout = window.setTimeout(() => void load(), interval);
      }
    };
    void load();
    return () => {
      stopped = true;
      controller.abort();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [enabled, lat, lon, radiusKm]);
  return result;
}
