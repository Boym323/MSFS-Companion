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

type TelemetryStatus = {
  mode: 'mock' | 'simconnect';
  connected: boolean;
  connectionState: string;
  lastTelemetryUtc: string | null;
  sampleAgeMs: number | null;
  sampleRateHz: number;
  samplesReceived: number;
  connectionAttempts: number;
  lastError: string | null;
  incomingRateHz: number;
  samplesPublished: number;
  framesSkipped: number;
  publicationLagMs: number | null;
};

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
  const [sourceStatus, setSourceStatus] = useState<TelemetryStatus | null>(null);

  useEffect(() => {
    let disposed = false;
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) return;
        const status = (await response.json()) as TelemetryStatus;
        if (!disposed) setSourceStatus(status);
      } catch {
        if (!disposed) setSourceStatus(null);
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

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

  const sourceIsLive = connection === 'connected'
    && sourceStatus?.connected === true
    && lastUpdateAgeMs !== null && lastUpdateAgeMs < 5000;
  const sourceMode = sourceStatus?.mode;
  const isMock = sourceMode === 'mock';
  const sourceLabel = sourceIsLive
    ? (isMock ? 'MOCK MODE' : 'SIMCONNECT LIVE')
    : sourceMode === 'simconnect'
      ? 'ČEKÁM NA MSFS'
      : 'ČEKÁM NA BRIDGE';
  const sourceHelp = sourceIsLive
    ? (isMock ? 'Ukázková data pro vývoj' : 'Skutečná data z MSFS 2020')
    : sourceStatus?.lastError ?? (sourceMode === 'simconnect'
      ? 'Spusťte MSFS 2020 a načtěte let'
      : 'Čekám na zdroj telemetrie');

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">✈</span><div>
          <strong>MSFS Companion</strong>
          <small>Flight deck · B2 telemetrie</small>
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
          <div className="eyebrow">B2 · TELEMETRIE</div>
          <h1>{pathname === '/pfd' ? 'Primární letový displej' : pathname === '/map' ? 'Mapa letu' : 'Přehled systému'}</h1>
          <p>{isPlaceholder
            ? 'Přístrojový modul připravujeme. Zdroj telemetrie již podporuje MSFS 2020.'
            : 'Přehled dat z MSFS 2020 přes SimConnect nebo z vývojového mock režimu.'}</p>
        </div>

        <section className="summary">
          <article>
            <span className="label">Zdroj dat</span>
            <strong>{sourceLabel}</strong>
            <span className="help">{sourceHelp}</span>
          </article>
          <article>
            <span className="label">Letadlo</span>
            <strong>{sourceIsLive ? telemetry?.aircraft ?? 'Čekám na data' : 'Čekám na letadlo'}</strong>
            <span className="help">{sourceIsLive ? (isMock ? 'Simulované hodnoty' : 'MSFS / SimConnect') : 'Spojení není aktivní'}</span>
          </article>
          <article>
            <span className="label">Telemetrie</span>
            <strong>{sourceIsLive ? `${sourceStatus?.sampleRateHz.toFixed(1) ?? '—'} Hz` : '—'}</strong>
            <span className="help">{sourceIsLive && lastUpdateAgeMs !== null
              ? `Stáří vzorku ${Math.round(lastUpdateAgeMs)} ms`
              : sourceMode === 'simconnect' ? `Pokus o spojení č. ${sourceStatus?.connectionAttempts ?? 0}` : 'Dosud bez dat'}</span>
          </article>
        </section>

        {sourceIsLive && sourceStatus && (
          <div className="telemetry-diagnostics" aria-label="Diagnostika přenosu telemetrie">
            <span><strong>Příjem ze simulátoru:</strong> {sourceStatus.incomingRateHz.toFixed(1)} Hz</span>
            <span><strong>Předávání do webu:</strong> {sourceStatus.sampleRateHz.toFixed(1)} Hz</span>
            <span><strong>Zpoždění ve frontě:</strong> {sourceStatus.publicationLagMs?.toFixed(0) ?? '—'} ms</span>
            <span><strong>Přijaté / předané:</strong> {sourceStatus.samplesReceived} / {sourceStatus.samplesPublished}</span>
            <span><strong>Přeskočené při převzorkování:</strong> {sourceStatus.framesSkipped}</span>
          </div>
        )}

        {!isPlaceholder && <PanelAktualizaci />}

        {!sourceIsLive && (
          <p className="telemetry-offline" role="status">
            {sourceMode === 'simconnect'
              ? 'SimConnect není připojený nebo neposílá čerstvá data. Zobrazované hodnoty nejsou platné.'
              : 'Čekám na telemetrii z bridge.'}
          </p>
        )}
        <h2>Aktuální telemetrie</h2>
        <section className="metrics">
          {values.map((metric) => (
            <article className="metric" key={metric.key}>
              <span className="label">{metric.title}</span>
              <div className="reading">
                <strong>{telemetry && sourceIsLive ? telemetry[metric.key].toFixed(metric.digits) : '—'}</strong>
                <span>{metric.unit}</span>
              </div>
            </article>
          ))}
        </section>

        <div className="footnote">
          <span>GPS: {telemetry && sourceIsLive ? `${telemetry.latitude.toFixed(5)}°, ${telemetry.longitude.toFixed(5)}°` : 'čekám na data'}</span>
          <span>Žádné příkazy nejsou v této etapě povolené.</span>
        </div>
      </main>
    </div>
  );
}
