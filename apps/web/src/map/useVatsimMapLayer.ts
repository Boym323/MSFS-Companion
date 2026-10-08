import { mapQueryCoordinate, mapQueryRadiusKm, validMapPilots, type MapPilot } from './vatsimMap';
import { useEffect, useState } from 'react';

export type VatsimMapPilot = MapPilot;
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
  const lat = mapQueryCoordinate(latitude, 85.05);
  const lon = mapQueryCoordinate(longitude, 180);
  const radiusKm = mapQueryRadiusKm(zoom);

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
            pilots: payload.available ? validMapPilots(payload.pilots) : [],
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
