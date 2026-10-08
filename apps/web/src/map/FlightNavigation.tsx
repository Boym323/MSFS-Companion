import { useEffect, useState } from 'react';
import type { Point } from './geo';
import './FlightNavigation.css';

export type Navigation = {
  flightPlanActive: boolean;
  waypointActive: boolean;
  waypointCount: number;
  waypointIndex: number;
  nextWaypointId: string | null;
  nextWaypoint: Point | null;
  previousWaypoint: Point | null;
  distanceNauticalMiles: number | null;
  eteSeconds: number | null;
  desiredTrackDegrees: number | null;
  crossTrackNauticalMiles: number | null;
  totalFlightPlanNauticalMiles: number | null;
  groundTrackDegrees: number | null;
};
type NavigationResponse = { connected: boolean; navigation: Navigation | null };

export function useFlightNavigation(live: boolean): Navigation | null {
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  useEffect(() => {
    if (!live) { setNavigation(null); return; }
    let closed = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/navigation/current', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json() as NavigationResponse;
        if (!closed) setNavigation(data.connected ? data.navigation : null);
      } catch { if (!closed) setNavigation(null); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { closed = true; window.clearInterval(timer); };
  }, [live]);
  return navigation;
}

const number = (value: number | null, digits = 1) =>
  value !== null && Number.isFinite(value) ? value.toFixed(digits) : '—';

export function FlightNavigationPanel({ navigation }: { navigation: Navigation | null }) {
  return <section className="flight-navigation" aria-label="GPS navigace">
    <h2>GPS · aktivní úsek</h2>
    {!navigation ? <p>Čekám na navigační údaje ze simulátoru.</p> : <>
      <div className="flight-navigation-values">
        <span><b>Flight plan</b>{navigation.flightPlanActive ? 'Aktivní' : 'Neaktivní'}</span>
        <span><b>Další waypoint</b>{navigation.waypointActive ? (navigation.nextWaypointId ?? 'GPS bod') : '—'}</span>
        <span><b>Pořadí bodu</b>{navigation.flightPlanActive && navigation.waypointCount > 0
          ? `${navigation.waypointIndex + 1}/${navigation.waypointCount}` : '—'}</span>
        <span><b>Vzdálenost</b>{number(navigation.distanceNauticalMiles)} NM</span>
        <span><b>ETE</b>{navigation.eteSeconds === null ? '—'
          : Math.round(navigation.eteSeconds / 60) + ' min'}</span>
        <span><b>Požadovaná trať</b>{number(navigation.desiredTrackDegrees, 0)}°</span>
        <span><b>Odchylka XTK</b>{number(navigation.crossTrackNauticalMiles, 2)} NM</span>
        <span><b>Délka flight planu</b>{number(navigation.totalFlightPlanNauticalMiles)} NM</span>
      </div>
    </>}
    <p className="flight-navigation-note">Modrá čára je proletěná stopa; přerušovaná žlutá značí
      aktivní navigační úsek. Standardní GPS SimVars neposkytují kompletní seznam bodů trasy,
      proto celou plánovanou trať nevymýšlíme.</p>
  </section>;
}
