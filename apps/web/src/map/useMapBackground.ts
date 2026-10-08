import { useState } from 'react';

const KEY = 'msfs-companion-osm-background';

/** Zapnuto ve výchozím stavu na /map i /flights; volba vypnutí je sdílená. */
export function useMapBackground(): readonly [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try { return window.localStorage.getItem(KEY) !== 'off'; }
    catch { return true; }
  });
  const change = (value: boolean) => {
    setEnabled(value);
    try { window.localStorage.setItem(KEY, value ? 'on' : 'off'); }
    catch { /* Soukromý režim může úložiště zakázat. */ }
  };
  return [enabled, change] as const;
}
