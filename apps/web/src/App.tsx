import { useTelemetry } from './telemetry/useTelemetry';
import Pfd from './pfd/Pfd';
import MovingMap from './map/MovingMap';
import FlightHistory from './flights/FlightHistory';
import AircraftDashboard from './aircraft/AircraftDashboard';
import PanelAktualizaci from './PanelAktualizaci';

const panels = [
  { href: '/admin', label: 'Přehled' },
  { href: '/pfd', label: 'PFD' },
  { href: '/map', label: 'Mapa' },
  { href: '/flights', label: 'Historie letů' },
  { href: '/aircraft', label: 'Letadlo' },
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
  const { telemetry, connection, sourceStatus, sourceIsLive, lastUpdateAgeMs, validTelemetry } = useTelemetry();
  const pathname = window.location.pathname;
  const isPfd = pathname === '/pfd';
  const isMap = pathname === '/map';
  const isFlights = pathname === '/flights';
  const isAircraft = pathname === '/aircraft';

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
          <small>Flight deck · MSFS 2020</small>
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
          <div className="eyebrow">{isPfd ? 'B3 · PRIMARY FLIGHT DISPLAY' : 'B2 · TELEMETRIE'}</div>
          <h1>{isPfd ? 'Primární letový displej' : isMap ? 'Mapa letu' : isFlights ? 'Historie letů' : isAircraft ? 'Aktuální letadlo' : 'Přehled systému'}</h1>
          <p>{isMap
            ? 'Živá mapa sleduje letadlo a vykresluje jeho proletěnou trasu.'
            : isPfd
              ? 'Umělý horizont, indikovaná rychlost, výška a magnetický kurz se živými daty SimConnect.'
              : isFlights
                ? 'Zaznamenané lety z Windows PC, jejich statistiky a přehrávání.'
                : isAircraft
                  ? 'Letové parametry, motor, vítr a stav autopilota – pouze čtení.'
                  : 'Přehled dat z MSFS 2020 přes SimConnect nebo z vývojového mock režimu.'}</p>
        </div>

        <section className={isPfd ? 'summary summary--compact' : 'summary'}>
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

        {!isMap && !isPfd && !isFlights && !isAircraft && <PanelAktualizaci />}

        {!sourceIsLive && (
          <p className="telemetry-offline" role="status">
            {sourceMode === 'simconnect'
              ? 'SimConnect není připojený nebo neposílá čerstvá data. Zobrazované hodnoty nejsou platné.'
              : 'Čekám na telemetrii z bridge.'}
          </p>
        )}
        {isPfd ? (
          <Pfd telemetry={validTelemetry} />
        ) : isMap ? (
          <MovingMap telemetry={validTelemetry} />
        ) : isFlights ? (
          <FlightHistory />
        ) : isAircraft ? (
          <AircraftDashboard telemetry={validTelemetry} />
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
