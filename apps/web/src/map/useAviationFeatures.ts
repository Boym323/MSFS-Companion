import { useEffect, useState } from 'react';

export type AviationFeature = {
  type: 'airport' | 'vor' | 'ndb';
  ident: string; name: string; latitude: number; longitude: number;
};
type Response = { available: boolean; features: AviationFeature[] };
export function useAviationFeatures(
  enabled: boolean, latitude: number | null, longitude: number | null,
): { available: boolean | null; features: AviationFeature[] } {
  const [result, setResult] = useState<{ available: boolean | null; features: AviationFeature[] }>({
    available: null, features: [],
  });
  const lat = latitude === null ? null : Math.round(latitude * 2) / 2;
  const lon = longitude === null ? null : Math.round(longitude * 2) / 2;
  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      setResult({ available: null, features: [] }); return;
    }
    let closed = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/map/aviation?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
          { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json() as Response;
        if (!closed) setResult({ available: data.available, features: data.features ?? [] });
      } catch { if (!closed) setResult({ available: false, features: [] }); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 35000);
    return () => { closed = true; window.clearInterval(timer); };
  }, [enabled, lat, lon]);
  return result;
}
