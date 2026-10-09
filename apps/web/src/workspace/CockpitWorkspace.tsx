import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import Pfd from '../pfd/Pfd';
import MovingMap from '../map/MovingMap';
import AircraftDashboard from '../aircraft/AircraftDashboard';
import CockpitControls from '../controls/CockpitControls';
import G1000Remote from '../g1000/G1000Remote';
import AdvancedAvionics from '../avionics/AdvancedAvionics';
import A320Dashboard from '../a320/A320Dashboard';
import './CockpitWorkspace.css';
import { normalizeWorkspace, type PanelId, type Layout } from './layout';
import { recommendedAircraftLayout, aircraftLayoutStorageKey } from './aircraftPresets';

const panels: { id: PanelId; name: string; path: string }[] = [
  { id:'pfd', name:'PFD', path:'/pfd' },
  { id:'map', name:'Mapa', path:'/map' },
  { id:'aircraft', name:'Systémy letadla', path:'/aircraft' },
  { id:'a320', name:'Airbus A320 readback', path:'/a320' },
  { id:'controls', name:'Ovládání kokpitu', path:'/controls' },
  { id:'g1000', name:'Garmin G1000', path:'/g1000' },
  { id:'avionics', name:'Další avionika', path:'/avionics' },
];
const presets: Record<string, PanelId[]> = {
  'Pilot / PFD + mapa': ['pfd','map'],
  'Navigace': ['map','aircraft'],
  'IFR avionika': ['pfd','controls','g1000'],
};
const storageKey = 'msfs-companion-workspace-v1';
function saved(): Layout {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? normalizeWorkspace(JSON.parse(raw)) : normalizeWorkspace(null);
  } catch { return normalizeWorkspace(null); }
}

export default function CockpitWorkspace({ telemetry, live }: {
  telemetry: TelemetrySnapshot | null; live: boolean;
}) {
  const [layout, setLayout] = useState<Layout>(saved);
  const [fullscreen, setFullscreen] = useState(false);
  const [aircraftMessage,setAircraftMessage]=useState('');
  const aircraftKey=live?aircraftLayoutStorageKey(telemetry?.aircraft):null;
  const recommended=live?recommendedAircraftLayout(telemetry?.aircraft):null;
  useEffect(()=>setAircraftMessage(''),[aircraftKey]);
  function saveForAircraft(){
    if(!aircraftKey)return;
    try {
      window.localStorage.setItem(aircraftKey,JSON.stringify(normalizeWorkspace(layout)));
      setAircraftMessage('Rozložení uloženo pouze v tomto prohlížeči pro toto letadlo.');
    } catch {setAircraftMessage('Rozložení nelze uložit (úložiště prohlížeče není dostupné).');}
  }
  function loadForAircraft(){
    if(!aircraftKey)return;
    try {
      const data=window.localStorage.getItem(aircraftKey);
      if(!data){setAircraftMessage('Pro toto letadlo ještě nemáte vlastní uložené rozložení.');return;}
      setLayout(normalizeWorkspace(JSON.parse(data)));
      setAircraftMessage('Ručně načteno rozložení tohoto letadla.');
    } catch {setAircraftMessage('Rozložení nelze načíst (neplatné či nedostupné údaje).');}
  }
  useEffect(() => {const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange',sync);
    return ()=>document.removeEventListener('fullscreenchange',sync);},[]);
  const toggleFullscreen=async()=>{
    try {if(document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('.cockpit-workspace')?.requestFullscreen();}
    catch { /* prohlížeč nebo oprávnění fullscreen nemusí podporovat */ }
  };
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(layout)); }
    catch { /* storage unavailable, layout still works in this tab */ }
  }, [layout]);

  function toggle(id: PanelId) {
    setLayout(old => {
      const visible = old.visible.includes(id) ? old.visible.filter(v => v !== id)
        : [...old.visible, id].slice(0,3);
      return visible.length ? { ...old, visible } : old;
    });
  }
  function move(id: PanelId, direction: -1 | 1) {
    setLayout(old => {
      const visible = [...old.visible], pos = visible.indexOf(id), to = pos + direction;
      if (pos < 0 || to < 0 || to >= visible.length) return old;
      [visible[pos], visible[to]] = [visible[to], visible[pos]];
      return { ...old, visible };
    });
  }
  function content(id: PanelId) {
    if (id === 'pfd') return <Pfd telemetry={telemetry} />;
    if (id === 'map') return <MovingMap telemetry={telemetry} />;
    if (id === 'aircraft') return <AircraftDashboard telemetry={telemetry} />;
    if (id === 'controls') return <CockpitControls live={live} />;
    if (id === 'a320') return <A320Dashboard telemetry={telemetry} live={live} />;
    if (id === 'g1000') return <G1000Remote live={live} />;
    return <AdvancedAvionics live={live} />;
  }

  return <section className="cockpit-workspace">
    <div className="cockpit-workspace-settings">
      <h2>Vlastní sestava panelů</h2>
      <button type="button" onClick={()=>void toggleFullscreen()} aria-pressed={fullscreen}>
        {fullscreen?'Ukončit celou obrazovku':'Zobrazit kokpit na celou obrazovku'}
      </button>
      <p>Vyberte až tři panely, jejich pořadí a rozložení. Nastavení se ukládá
        pouze v tomto prohlížeči. Na iPadu se sloupce automaticky skládají pod sebe.</p>
      <div className="cockpit-workspace-choices">
        {Object.entries(presets).map(([name, visible]) =>
          <button key={name} type="button" onClick={() => setLayout(old => ({ ...old, visible }))}>
            {name}
          </button>)}
        <button type="button" onClick={() => setLayout({ columns:1, visible:['pfd','map'] })}>
          Obnovit výchozí
        </button>
      </div>
      <section className="cockpit-workspace-aircraft">
        <strong>C50 · Profil rozložení podle letadla</strong>
        <p>{aircraftKey ? 'Aktuální letadlo: '+telemetry?.aircraft
          : 'Pro uložení konkrétního rozložení musí být připojen živý MSFS.'}</p>
        <p>Výběr je vždy ruční: změna letadla sama nepřepne žádný panel.
          Kandidátní avionika nemusí být v MSFS dostupná.</p>
        <div className="cockpit-workspace-choices">
          <button type="button" disabled={!recommended}
            onClick={()=>{if(recommended){setLayout(recommended.layout);
              setAircraftMessage('Načten návrh: '+recommended.name+'. Ovladače je nutné ověřit v MSFS.');}}}>
            Použít doporučené panely
          </button>
          <button type="button" disabled={!aircraftKey} onClick={saveForAircraft}>
            Uložit pro toto letadlo
          </button>
          <button type="button" disabled={!aircraftKey} onClick={loadForAircraft}>
            Načíst uložené
          </button>
        </div>
        {aircraftMessage&&<p role="status">{aircraftMessage}</p>}
      </section>
      <fieldset>
        <legend>Aktivní panely (max. 3)</legend>
        {panels.map(panel =>
          <label key={panel.id}>
            <input type="checkbox" checked={layout.visible.includes(panel.id)}
              disabled={!layout.visible.includes(panel.id) && layout.visible.length >= 3}
              onChange={() => toggle(panel.id)} /> {panel.name}
          </label>)}
      </fieldset>
      <label>Rozložení na širší obrazovce
        <select value={layout.columns} onChange={e =>
          setLayout(old => ({ ...old, columns:e.target.value === '2' ? 2 : 1 }))}>
          <option value="1">Jeden sloupec</option>
          <option value="2">Dva sloupce</option>
        </select>
      </label>
    </div>
    <div className={'cockpit-workspace-panels cockpit-workspace-panels--'+layout.columns}>
      {layout.visible.map((id,index) => {
        const metadata = panels.find(panel => panel.id === id)!;
        return <article key={id} className="cockpit-workspace-panel">
          <header className="cockpit-workspace-panel-head">
            <strong>{metadata.name}</strong>
            <div>
              <button type="button" disabled={index === 0} onClick={() => move(id,-1)}
                aria-label={'Posunout '+metadata.name+' výše'}>↑</button>
              <button type="button" disabled={index === layout.visible.length-1} onClick={() => move(id,1)}
                aria-label={'Posunout '+metadata.name+' níže'}>↓</button>
              <a href={metadata.path}>Celá obrazovka ↗</a>
            </div>
          </header>
          {content(id)}
        </article>;
      })}
    </div>
  </section>;
}
