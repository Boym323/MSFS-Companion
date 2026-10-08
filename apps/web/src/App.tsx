import { useEffect, useState } from 'react';
import PanelAktualizaci from './PanelAktualizaci';

type TelemetrySnapshot = {
  timestampUtc: string;
  aircraft: string;
  latitude: number;
  longitude: number;
  airspeedKnots: number;
  altitudeFeet: number;
  verticalSpeedFeetPerMinute: number;
  headingDegrees: number;
  pitchDegrees: number;
  bankDegrees: number;
};

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const panels = [
  { href: '/admin', label: 'Přehled' },
  { href: '/pfd', label: 'PFD' },
  { href: '/map', label: 'Mapa' },
];

const values = [
  { key: 'airspeedKnots', title: 'Indikovaná rychlost', unit: 'KT', digits: 1 },
  { key: 'altitudeFeet', title: 'Výška', unit: 'FT', digits: 0 },
  { key: 'verticalSpeedFeetPerMinute', title: 'Vertikální rychlost', unit: 'FPM', digits: 0 },
  { key: 'headingDegrees', title: 'Kurz', unit: '°', digits: 1 },
  { key: 'pitchDegrees', title: 'Klopení', unit: '°', digits: 1 },
  { key: 'bankDegrees', title: 'Náklon', unit: '°', digits: 1 },
] as const;

export default function App() {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;

    const connect = () => {
      setConnection('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => setConnection('connected');
      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          setTelemetry(JSON.parse(event.data) as TelemetrySnapshot);
        } catch {
          // Ignore malformed telemetry frames; the next update can recover.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnection('disconnected');
        reconnectTimer = setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const pathname = window.location.pathname;
  const isPlaceholder = pathname === '/pfd' || pathname === '/map';
  const lastUpdateAgeMs = telemetry
    ? Math.max(0, Date.now() - new Date(telemetry.timestampUtc).getTime())
    : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">✈</span><div>
          <strong>MSFS Companion</strong>
          <small>Flight deck · vývojová verze 0.1.0</small>
        </div></div>
        <div className={`connection connection--${connection}`}>
          <span className="connection-dot" />
          {connection === 'connected' ? 'Bridge připojen' : connection === 'connecting' ? 'Připojování' : 'Bridge odpojen'}
        </div>
      </header>

      <nav aria-label="Navigace" className="tabs">
        {panels.map((panel) => (
          <a key={panel.href} href={panel.href}
            className={pathname === panel.href || (pathname === '/' && panel.href === '/admin') ? 'selected' : ''}>
            {panel.label}
          </a>
        ))}
      </nav>

      <main>
        <div className="intro">
          <div className="eyebrow">FOUNDATION V1</div>
          <h1>{pathname === '/pfd' ? 'Primární letový displej' : pathname === '/map' ? 'Mapa letu' : 'Přehled systému'}</h1>
          <p>{isPlaceholder
            ? 'Modul je připravený pro další etapu. Živá telemetrie už proudí přes WebSocket.'
            : 'První funkční propojení .NET bridge, mock simulátoru a React dashboardu.'}</p>
        </div>

        <section className="summary">
          <article>
            <span className="label">Zdroj dat</span>
            <strong>MOCK MODE</strong>
            <span className="help">SimConnect připojíme na Windows</span>
          </article>
          <article>
            <span className="label">Letadlo</span>
            <strong>{telemetry?.aircraft ?? 'Čekám na data'}</strong>
            <span className="help">Simulované hodnoty</span>
          </article>
          <article>
            <span className="label">Telemetrie</span>
            <strong>20 Hz</strong>
            <span className="help">{lastUpdateAgeMs === null ? 'Dosud bez dat' : `Stáří vzorku cca ${lastUpdateAgeMs} ms`}</span>
          </article>
        </section>

        {!isPlaceholder && <PanelAktualizaci />}

        <h2>Aktuální telemetrie</h2>
        <section className="metrics">
          {values.map((metric) => (
            <article className="metric" key={metric.key}>
              <span className="label">{metric.title}</span>
              <div className="reading">
                <strong>{telemetry ? telemetry[metric.key].toFixed(metric.digits) : '—'}</strong>
                <span>{metric.unit}</span>
              </div>
            </article>
          ))}
        </section>

        <div className="footnote">
          <span>GPS: {telemetry ? `${telemetry.latitude.toFixed(5)}°, ${telemetry.longitude.toFixed(5)}°` : 'čekám na data'}</span>
          <span>Žádné příkazy nejsou v této etapě povolené.</span>
        </div>
      </main>
    </div>
  );
}
