import { useTelemetry } from './telemetry/useTelemetry';
import Pfd from './pfd/Pfd';
import MovingMap from './map/MovingMap';
import FlightHistory from './flights/FlightHistory';
import AircraftDashboard from './aircraft/AircraftDashboard';
import PanelAktualizaci from './PanelAktualizaci';
import CockpitControls from './controls/CockpitControls';
import G1000Remote from './g1000/G1000Remote';
import AdvancedAvionics from './avionics/AdvancedAvionics';
import FlightPlanner from './planning/FlightPlanner';
import CockpitWorkspace from './workspace/CockpitWorkspace';
import AircraftCapabilities from './aircraft/AircraftCapabilities';
import './aircraft/AircraftCapabilities.css';

const panels = [
  { href: '/admin', label: 'Přehled' },
  { href: '/pfd', label: 'PFD' },
  { href: '/map', label: 'Mapa' },
  { href: '/flight-plan', label: 'Plán letu' },
  { href: '/workspace', label: 'Moje panely' },
  { href: '/flights', label: 'Historie letů' },
  { href: '/aircraft', label: 'Letadlo' },
  { href: '/capabilities', label: 'Profily' },
  { href: '/controls', label: 'Ovládání' },
  { href: '/g1000', label: 'G1000' },
  { href: '/avionics', label: 'Avionika' },
];

const pageMeta = {
  '/admin': { eyebrow: 'PALUBNÍ PŘEHLED', heading: 'Přehled systému', description: 'Stav propojení s MSFS 2020 a aktuální letové údaje.' },
  '/pfd': { eyebrow: 'LETOVÉ PŘÍSTROJE', heading: 'Primární letový displej', description: 'Umělý horizont, rychlost, výška, vertikální rychlost a magnetický kurz.' },
  '/map': { eyebrow: 'NAVIGACE', heading: 'Mapa letu', description: 'Aktuální poloha letadla a proletěná trasa.' },
  '/flight-plan': { eyebrow: 'PLÁNOVÁNÍ C9', heading: 'Letový plán SimBrief', description: 'Import posledního OFP na vyžádání.' },
  '/workspace': { eyebrow: 'KOKPIT C11', heading: 'Vlastní sestava displejů', description: 'Uspořádání přístrojů pro tablet a notebook.' },
  '/flights': { eyebrow: 'LETOVÝ DENÍK', heading: 'Historie letů', description: 'Záznamy letů, jejich statistiky a přehrávání.' },
  '/capabilities': { eyebrow: 'AVIONIKA C13', heading: 'Dostupné ovládací prvky', description: 'Nativní inventura avioniky v aktuálním letadle.' },
  '/aircraft': { eyebrow: 'SYSTÉMY LETADLA', heading: 'Aktuální letadlo', description: 'Letové parametry, motor, vítr a stav systémů · pouze čtení.' },
  '/controls': { eyebrow: 'KOKPIT C1–C2', heading: 'Dálkové ovládání avioniky', description: 'Rádia, transpondér a autopilot.' },
  '/g1000': { eyebrow: 'AVIONIKA C3', heading: 'G1000 Remote', description: 'Ovladače PFD/MFD dostupné přes Input Events aktuálního letadla.' },
  '/avionics': { eyebrow: 'AVIONIKA C6', heading: 'Další typy avioniky', description: 'Ovládání G3X, G3000, GNS430 a GNS530 s ověřením dostupnosti.' },
} as const;

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
  const page = pageMeta[pathname as keyof typeof pageMeta] ?? pageMeta['/admin'];
  const isPfd = pathname === '/pfd';
  const isMap = pathname === '/map';
  const isFlightPlan = pathname === '/flight-plan';
  const isWorkspace = pathname === '/workspace';
  const isFlights = pathname === '/flights';
  const isAircraft = pathname === '/aircraft';
  const isCapabilities = pathname === '/capabilities';
  const isControls = pathname === '/controls';
  const isG1000 = pathname === '/g1000';
  const isAvionics = pathname === '/avionics';

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
            className={pathname === panel.href || (pathname === '/' && panel.href === '/admin') ? 'selected' : ''}
            aria-current={pathname === panel.href || (pathname === '/' && panel.href === '/admin') ? 'page' : undefined}>
            {panel.label}
          </a>
        ))}
      </nav>

      <main>
        <div className="intro">
          <div className="eyebrow">{page.eyebrow}</div>
          <h1>{page.heading}</h1>
          <p>{page.description}</p>
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
          <details className="telemetry-diagnostics">
            <summary>Diagnostika přenosu · {sourceStatus?.incomingRateHz.toFixed(1)} / {sourceStatus?.sampleRateHz.toFixed(1)} Hz</summary>
            <div className="telemetry-diagnostics-body">
            <span><strong>Příjem ze simulátoru:</strong> {sourceStatus.incomingRateHz.toFixed(1)} Hz</span>
            <span><strong>Předávání do webu:</strong> {sourceStatus.sampleRateHz.toFixed(1)} Hz</span>
            <span><strong>Zpoždění ve frontě:</strong> {sourceStatus.publicationLagMs?.toFixed(0) ?? '—'} ms</span>
            <span><strong>Přijaté / předané:</strong> {sourceStatus.samplesReceived} / {sourceStatus.samplesPublished}</span>
            <span><strong>Přeskočené při převzorkování:</strong> {sourceStatus.framesSkipped}</span>
            </div>
          </details>
        )}

        {!isMap && !isPfd && !isFlights && !isAircraft && !isCapabilities && !isControls && !isG1000 && !isAvionics && !isFlightPlan && !isWorkspace && <PanelAktualizaci />}

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
        ) : isFlightPlan ? (
          <FlightPlanner />
        ) : isWorkspace ? (
          <CockpitWorkspace telemetry={validTelemetry} live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isFlights ? (
          <FlightHistory />
        ) : isCapabilities ? (
          <AircraftCapabilities live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isAircraft ? (
          <AircraftDashboard telemetry={validTelemetry} />
        ) : isControls ? (
          <CockpitControls live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isG1000 ? (
          <G1000Remote live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isAvionics ? (
          <AdvancedAvionics live={sourceIsLive && sourceMode === 'simconnect'} />
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
            <span>Ovládání je dostupné pouze po lokálním zapnutí a spárování na záložce Ovládání.</span>
          </div>
          </>
        )}
      </main>
    </div>
  );
}
