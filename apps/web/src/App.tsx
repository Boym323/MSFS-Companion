import { useTelemetry } from './telemetry/useTelemetry';
import CockpitHeader from './navigation/CockpitHeader';
import Pfd from './pfd/Pfd';
import MovingMap from './map/MovingMap';
import FlightHistory from './flights/FlightHistory';
import AircraftDashboard from './aircraft/AircraftDashboard';
import A320Dashboard from './a320/A320Dashboard';
import PanelAktualizaci from './PanelAktualizaci';
import CockpitControls from './controls/CockpitControls';
import G1000Remote from './g1000/G1000Remote';
import AdvancedAvionics from './avionics/AdvancedAvionics';
import FlightPlanner from './planning/FlightPlanner';
import CockpitWorkspace from './workspace/CockpitWorkspace';
import AircraftCapabilities from './aircraft/AircraftCapabilities';
import AviationWeather from './weather/AviationWeather';
import VatsimCenter from './vatsim/VatsimCenter';
import SystemHealth from './health/SystemHealth';
import AirportBriefing from './briefing/AirportBriefing';
import FlightProgress from './progress/FlightProgress';
import FuelMonitor from './fuel/FuelMonitor';
import SmartRadio from './radio/SmartRadio';
import AircraftChecklists from './checklists/AircraftChecklists';
import PilotAssistant from './assistant/PilotAssistant';
import LiveValidation from './validation/LiveValidation';
import './vatsim/VatsimCenter.css';
import './weather/AviationWeather.css';
import './aircraft/AircraftCapabilities.css';

const pageMeta = {
  '/pilot': {eyebrow:'KOKPIT',heading:'Letový asistent',description:'Jedno místo pro navigaci, mapu, rádio, palivo a checklisty.'},
  '/validation': {eyebrow:'TESTOVÁNÍ',heading:'Ověření kompatibility',description:'Ručně potvrzené výsledky z reálného MSFS 2020.'},
  '/health': { eyebrow: 'SYSTÉM', heading: 'Diagnostika Companion', description: 'Stav SimConnect, externích dat a lokální sítě.' },
  '/admin': { eyebrow: 'PALUBNÍ PŘEHLED', heading: 'Přehled systému', description: 'Stav propojení s MSFS 2020 a aktuální letové údaje.' },
  '/pfd': { eyebrow: 'LETOVÉ PŘÍSTROJE', heading: 'Primární letový displej', description: 'Umělý horizont, rychlost, výška, vertikální rychlost a magnetický kurz.' },
  '/map': { eyebrow: 'NAVIGACE', heading: 'Mapa letu', description: 'Aktuální poloha letadla a proletěná trasa.' },
  '/briefing': { eyebrow: 'LETECKÉ ÚDAJE', heading: 'Letištní briefing', description: 'Dráhy, frekvence, METAR a TAF na jednom místě.' },
  '/progress': { eyebrow: 'NAVIGACE', heading: 'Průběh GPS úseku', description: 'Živá vzdálenost, čas a odchylka od plánované trasy.' },
  '/radio-assistant': { eyebrow: 'RADIO', heading: 'Smart Radio Assistant', description: 'Letištní frekvence a bezpečné COM1 standby.' },
  '/checklists': { eyebrow: 'CHECKLIST', heading: 'Checklisty letadla', description: 'Upravitelné ruční kontrolní seznamy pro simulátor.' },
  '/fuel': { eyebrow: 'PALIVO', heading: 'Vytrvalost a rezerva', description: 'Odhad z doloženého poklesu paliva v MSFS.' },
  '/flight-plan': { eyebrow: 'PLÁNOVÁNÍ', heading: 'Letový plán SimBrief', description: 'Import posledního OFP na vyžádání.' },
  '/workspace': { eyebrow: 'KOKPIT', heading: 'Vlastní sestava displejů', description: 'Uspořádání přístrojů pro tablet a notebook.' },
  '/flights': { eyebrow: 'LETOVÝ DENÍK', heading: 'Historie letů', description: 'Záznamy letů, jejich statistiky a přehrávání.' },
  '/vatsim': { eyebrow: 'ATC', heading: 'Online provoz VATSIM', description: 'Piloti a frekvence VATSIM bez další instalace.' },
  '/weather': { eyebrow: 'AVIATION', heading: 'Letecké počasí', description: 'Aktuální METAR a TAF bez dalšího softwaru.' },
  '/capabilities': { eyebrow: 'AVIONIKA', heading: 'Dostupné ovládací prvky', description: 'Nativní inventura avioniky v aktuálním letadle.' },
  '/aircraft': { eyebrow: 'SYSTÉMY LETADLA', heading: 'Aktuální letadlo', description: 'Letové parametry, motor, vítr a stav systémů · pouze čtení.' },
  '/a320': {eyebrow:'LETADLO · ASOBO',heading:'Airbus A320neo',description:'FCU, navigace, systémy a MCDU na samostatných pracovních plochách. Ovládání jen s ověřeným povolením.'},
  '/controls': { eyebrow: 'KOKPIT', heading: 'Dálkové ovládání avioniky', description: 'Rádia, transpondér a autopilot.' },
  '/g1000': { eyebrow: 'AVIONIKA', heading: 'G1000 Remote', description: 'Ovladače PFD/MFD dostupné přes Input Events aktuálního letadla.' },
  '/avionics': { eyebrow: 'AVIONIKA', heading: 'Další typy avioniky', description: 'Ovládání G3X, G3000, GNS430 a GNS530 s ověřením dostupnosti.' },
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
  const isPilot = pathname === '/pilot';
  const isValidation = pathname === '/validation';
  const isHealth = pathname === '/health';
  const isPfd = pathname === '/pfd';
  const isMap = pathname === '/map';
  const isFlightPlan = pathname === '/flight-plan';
  const isBriefing = pathname === '/briefing';
  const isProgress = pathname === '/progress';
  const isFuel = pathname === '/fuel';
  const isRadioAssistant = pathname === '/radio-assistant';
  const isChecklists = pathname === '/checklists';
  const isWorkspace = pathname === '/workspace';
  const isFlights = pathname === '/flights';
  const isAircraft = pathname === '/aircraft';
  const isA320=pathname==='/a320';
  const isCapabilities = pathname === '/capabilities';
  const isWeather = pathname === '/weather';
  const isVatsim = pathname === '/vatsim';
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
      <CockpitHeader pathname={pathname} connection={connection}
        sourceStatus={sourceStatus} sourceIsLive={sourceIsLive}
        aircraft={sourceIsLive ? telemetry?.aircraft ?? null : null} />

      <main>
        {!isA320&&<div className="intro">
          <div className="eyebrow">{page.eyebrow}</div>
          <h1>{page.heading}</h1>
          <p>{page.description}</p>
        </div>}

        {(pathname==='/admin'||pathname==='/')&&<section className="summary">
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
        </section>}

        {(isHealth||pathname==='/admin'||pathname==='/')&&sourceIsLive && sourceStatus && (
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

        {!isPilot && !isValidation && !isHealth && !isMap && !isPfd && !isFlights && !isAircraft && !isA320 && !isCapabilities && !isWeather && !isVatsim && !isControls && !isG1000 && !isAvionics && !isBriefing && !isProgress && !isFuel && !isRadioAssistant && !isChecklists && !isFlightPlan && !isWorkspace && <PanelAktualizaci />}

        {!sourceIsLive && (
          <p className="telemetry-offline" role="status">
            {sourceMode === 'simconnect'
              ? 'SimConnect není připojený nebo neposílá čerstvá data. Zobrazované hodnoty nejsou platné.'
              : 'Čekám na telemetrii z bridge.'}
          </p>
        )}
        {isPilot ? (
          <PilotAssistant telemetry={validTelemetry} live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isValidation ? (
          <LiveValidation telemetry={validTelemetry} live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isHealth ? (
          <SystemHealth />
        ) : isPfd ? (
          <Pfd telemetry={validTelemetry} />
        ) : isMap ? (
          <MovingMap telemetry={validTelemetry} />
        ) : isBriefing ? (
          <AirportBriefing />
        ) : isProgress ? (
          <FlightProgress telemetry={validTelemetry} />
        ) : isFuel ? (
          <FuelMonitor telemetry={validTelemetry} />
        ) : isRadioAssistant ? (
          <SmartRadio live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isChecklists ? (
          <AircraftChecklists telemetry={validTelemetry} />
        ) : isFlightPlan ? (
          <FlightPlanner />
        ) : isWorkspace ? (
          <CockpitWorkspace telemetry={validTelemetry} live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isFlights ? (
          <FlightHistory />
        ) : isVatsim ? (
          <VatsimCenter telemetry={validTelemetry} />
        ) : isWeather ? (
          <AviationWeather />
        ) : isCapabilities ? (
          <AircraftCapabilities live={sourceIsLive && sourceMode === 'simconnect'} />
        ) : isAircraft ? (
          <AircraftDashboard telemetry={validTelemetry} />
        ) : isA320 ? (
          <A320Dashboard telemetry={validTelemetry}
            live={sourceIsLive&&sourceMode==='simconnect'} />
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
