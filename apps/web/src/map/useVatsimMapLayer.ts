import { useEffect, useState } from 'react';

export type VatsimMapPilot = {
  callsign: string;
  latitude: number;
  longitude: number;
  altitudeFeet: number;
  groundSpeedKt: number;
  heading: number;
  aircraft: string | null;
};
export type VatsimMapState = {
  available: boolean;
  stale: boolean;
  updatedAt: string | null;
  error: string | null;
  pilots: VatsimMapPilot[];
};
const empty: VatsimMapState = {
  available: false, stale: false, updatedAt: null, error: null, pilots: [],
};

/** The VATSIM layer is strictly opt-in and independent of SimConnect and map tiles. */
export function useVatsimMapLayer(enabled: boolean, latitude: number | null,
  longitude: number | null, zoom: number): VatsimMapState {
  const [data, setData] = useState<VatsimMapState>(empty);
  // Snap requests to a coarse center so high-rate SimConnect movement does not
  // restart fetches or over-query the public VATSIM API.
  const lat = latitude != null && Number.isFinite(latitude) && Math.abs(latitude) <= 85.05
    ? Math.round(latitude * 10) / 10 : null;
  const lon = longitude != null && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? Math.round(longitude * 10) / 10 : null;
  const radiusKm = Math.max(30, Math.min(300, Math.round(100 * 2 ** (10 - zoom))));

  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      setData(empty);
      return;
    }
    let stopped = false;
    const controller = new AbortController();
    let timer: number | undefined;
    setData(empty);

    async function load() {
      try {
        const params = new URLSearchParams({
          lat: String(lat), lon: String(lon), radiusKm: String(radiusKm),
        });
        const response = await fetch('/api/vatsim/nearby?' + params.toString(),
          { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('VATSIM unavailable');
        const payload = await response.json() as VatsimMapState;
        if (!stopped) {
          setData({
            available: payload.available,
            stale: payload.stale,
            updatedAt: payload.updatedAt,
            error: payload.error,
            pilots: payload.available && Array.isArray(payload.pilots)
              ? payload.pilots.slice(0, 80).filter(p =>
                Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
                Math.abs(p.latitude) <= 85.05 && Math.abs(p.longitude) <= 180)
              : [],
          });
        }
      } catch {
        if (!stopped) {
          setData(old => ({
            ...old, stale: old.available,
            error: 'VATSIM nelze načíst. Zobrazená data mohou být starší.',
          }));
        }
      } finally {
        if (!stopped) timer = window.setTimeout(() => void load(), 35000);
      }
    }

    void load();
    return () => {
      stopped = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, lat, lon, radiusKm]);

  return data;
}
