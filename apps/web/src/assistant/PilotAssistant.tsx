import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import MovingMap from '../map/MovingMap';
import Pfd from '../pfd/Pfd';
import FlightProgress from '../progress/FlightProgress';
import FuelMonitor from '../fuel/FuelMonitor';
import SmartRadio from '../radio/SmartRadio';
import AircraftChecklists from '../checklists/AircraftChecklists';
import { pilotHints, pilotPhase, phaseTitles } from './pilotLogic';
import { readPhaseEvidence, type PhaseEvidence } from './systemsPhase';
import './PilotAssistant.css';

type Tab = 'map' | 'progress' | 'fuel' | 'radio' | 'checklists' | 'pfd';
const tabs: { id: Tab; title: string }[] = [
  {id:'map',title:'Mapa'}, {id:'progress',title:'Navigace'},
  {id:'fuel',title:'Palivo'}, {id:'radio',title:'Rádio'},
  {id:'checklists',title:'Checklisty'}, {id:'pfd',title:'PFD'},
];
export default function PilotAssistant({telemetry, live}: {
  telemetry: TelemetrySnapshot | null; live: boolean;
}) {
  const [tab, setTab] = useState<Tab>('map');
  const [evidence, setEvidence] = useState<PhaseEvidence | null>(null);
  const aircraft = telemetry?.aircraft ?? '';
  useEffect(() => {
    if (!live || !aircraft) { setEvidence(null); return; }
    let closed = false;
    let busy = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (busy || closed) return;
      busy = true;
      try {
        const response = await fetch('/api/aircraft/systems',
          { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Systémová telemetrie není dostupná');
        const result: unknown = await response.json();
        if (!closed) setEvidence(readPhaseEvidence(result, aircraft, Date.now()));
      } catch {
        if (!closed) setEvidence(null);
      } finally { busy = false; }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 2000);
    return () => { closed = true; controller.abort(); window.clearInterval(interval); };
  }, [live, aircraft]);

  // Pomalá 1Hz SimConnect data doplňují již existující rychlý WebSocket,
  // nikoli další SimConnect subscription. Staré nebo cizí letadlo se ignoruje.
  const currentEvidence = live && telemetry && evidence?.aircraft === aircraft
    && Date.now() - evidence.observedAtMs < 5000 ? evidence : null;
  const phase = pilotPhase(live && telemetry ? {
    ...telemetry,
    onGround: currentEvidence?.onGround ?? null,
    altitudeAglFeet: currentEvidence?.altitudeAglFeet ?? null,
  } : null);
  const display = (n: number | undefined, unit: string) =>
    n != null && Number.isFinite(n) && live ? Math.round(n).toLocaleString('cs-CZ') + ' ' + unit : '—';
  return <section className="pilot-assistant">
    <div className="pilot-assistant-context">
      <div><span>Aktuální fáze · odhad z MSFS</span><h2>{phaseTitles[phase]}</h2>
        <p>Nejde o automatický letový režim ani certifikované pilotní instrukce.</p></div>
      <div className="pilot-assistant-readings">
        <article><small>IAS</small><strong>{display(telemetry?.airspeedKnots,'KT')}</strong></article>
        <article><small>Výška</small><strong>{display(telemetry?.altitudeFeet,'FT')}</strong></article>
        <article><small>V/S</small><strong>{display(telemetry?.verticalSpeedFeetPerMinute,'FPM')}</strong></article>
      </div>
    </div>
    <div className="pilot-assistant-tips" aria-label="Orientační připomínky pro fázi letu">
      {pilotHints(phase).map(hint => <p key={hint}>{hint}</p>)}
    </div>
    <nav className="pilot-assistant-tabs" aria-label="Nástroje za letu">
      {tabs.map(item => <button type="button" key={item.id}
        aria-pressed={tab===item.id} onClick={()=>setTab(item.id)}>{item.title}</button>)}
    </nav>
    <div className="pilot-assistant-tool">
      {tab==='map' ? <MovingMap telemetry={live?telemetry:null}/> :
       tab==='progress' ? <FlightProgress telemetry={live?telemetry:null}/> :
       tab==='fuel' ? <FuelMonitor telemetry={live?telemetry:null}/> :
       tab==='radio' ? <SmartRadio live={live}/> :
       tab==='checklists' ? <AircraftChecklists telemetry={live?telemetry:null}/> :
       <Pfd telemetry={live?telemetry:null}/>}
    </div>
    <p className="pilot-assistant-disclaimer">
      Zdrojem jsou existující panely; neprovádíme žádné automatické zásahy do simulátoru.
      Při výpadku SimConnectu nejsou zobrazovány domnělé živé hodnoty.
    </p>
  </section>;
}