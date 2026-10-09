import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import FlightInsights from './FlightInsights';
import FlightRouteMap from './FlightRouteMap';
import FlightReplayCharts from './FlightReplayCharts';
import { exportFlightCsv } from './performance';
import { exportFlightGpx, exportFlightKml } from './logbookExport';
import {createLogbookArchive,inspectLogbookArchive,ARCHIVE_LIMIT_BYTES,
  type ArchivedFlight} from './logbookBackup';
import { analyzeFlight } from './analysis';
import './FlightHistory.css';

type FlightSummary = {
  id: string;
  mode: 'mock' | 'simconnect';
  aircraft: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  lastAtUtc: string;
  samples: number;
  distanceMeters: number;
  maxAirspeedKnots: number;
  maxAltitudeFeet: number;
  active: boolean;
};
type FlightDetail = { summary: FlightSummary; samples: TelemetrySnapshot[] };

function timestamp(value: string) {
  return new Date(value).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'medium' });
}
function elapsed(summary: FlightSummary) {
  const seconds = Math.max(0, Math.round((Date.parse(summary.lastAtUtc) - Date.parse(summary.startedAtUtc)) / 1000));
  return `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
}

export default function FlightHistory() {
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const [compareId, setCompareId] = useState('');
  const [comparison, setComparison] = useState<FlightDetail | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [backupBusy,setBackupBusy]=useState(false);
  const [backupMessage,setBackupMessage]=useState('');
  const [backupPreview,setBackupPreview]=useState<ReturnType<typeof inspectLogbookArchive>|null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/flights', { cache: 'no-store' });
        if (!response.ok) throw new Error('Historii nelze načíst z Windows bridge.');
        const list = (await response.json()) as FlightSummary[];
        if (cancelled) return;
        setFlights(list);
        setSelected((old) => old || list[0]?.id || '');
        setError('');
      } catch {
        if (!cancelled) setError('Záznamy letu nejsou dostupné. Zkontrolujte Windows bridge.');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/flights/${encodeURIComponent(selected)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Záznam letu nebyl nalezen.');
        const data = (await response.json()) as FlightDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selected]);

  function download(format: 'csv'|'gpx'|'kml') {
    if (!detail || !detail.samples.length) return;
    try {
      const data = format === 'csv' ? exportFlightCsv(detail.samples)
        : format === 'gpx' ? exportFlightGpx(detail.samples, detail.summary.aircraft)
        : exportFlightKml(detail.samples, detail.summary.aircraft);
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv;charset=utf-8'
        : 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href=url;
      link.download='kokpit-let-'+detail.summary.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.'+format;
      document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(e instanceof Error ? e.message : 'Export záznamu selhal.');}
  }
  async function exportBackup(){
    if(backupBusy||flights.length===0)return;
    setBackupBusy(true);setBackupMessage('Zpracovávám dostupné lety z Windows bridge…');
    setBackupPreview(null);
    try{
      if(flights.length>30)throw Error('Překročen počet letů dostupných pro jediný archiv.');
      const records:ArchivedFlight[]=[];
      for(const item of flights){
        const controller=new AbortController();
        const timer=window.setTimeout(()=>controller.abort(),10000);
        try{
          const response=await fetch('/api/flights/'+encodeURIComponent(item.id),
            {cache:'no-store',signal:controller.signal});
          if(!response.ok)throw Error('Nepodařilo se stáhnout let '+item.id);
          const data=await response.json() as FlightDetail;
          if(data.summary.id!==item.id||!Array.isArray(data.samples))
            throw Error('Let '+item.id+' neodpovídá požadovanému záznamu.');
          records.push({summary:data.summary,samples:data.samples});
        }finally{window.clearTimeout(timer);}
      }
      const data=createLogbookArchive(records,new Date().toISOString());
      const link=document.createElement('a');
      const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
      try{
        link.href=url;link.download='kokpit-zaloha-letu-'+
          new Date().toISOString().slice(0,10)+'.json';
        document.body.append(link);link.click();link.remove();
      }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setBackupMessage('Záloha '+records.length+' letů připravena ke stažení. Soubor obsahuje GPS polohy; uchovávejte jej soukromě.');
    }catch(e){setBackupMessage(e instanceof Error?e.message:'Export zálohy selhal.');}
    finally{setBackupBusy(false);}
  }
  async function inspectBackup(file:File|null){
    setBackupPreview(null);
    if(!file)return;
    if(file.size>ARCHIVE_LIMIT_BYTES){
      setBackupMessage('Soubor přesahuje limit 20 MB.');return;
    }
    try{
      const preview=inspectLogbookArchive(await file.text());
      setBackupPreview(preview);
      setBackupMessage('Formát zálohy prošel lokální kontrolou. Import do Windows bridge není zapnutý.');
    }catch(e){setBackupMessage(e instanceof Error?e.message:'Neplatná záloha.');}
  }
  async function compare() {
    if (!compareId || compareId === selected || compareBusy) return;
    setCompareBusy(true);setComparison(null);
    try {const r=await fetch('/api/flights/'+encodeURIComponent(compareId),{cache:'no-store'});
      if (!r.ok) throw Error(); const data=await r.json() as FlightDetail;
      if (data.summary.id === compareId && Array.isArray(data.samples)) setComparison(data);
      else setError('Porovnávaný let nemá platné údaje.');
    }catch{setError('Druhý let není k dispozici pro porovnání.');}
    finally{setCompareBusy(false);}
  }
  const samples = detail?.samples ?? [];
  const index = Math.min(cursor, Math.max(0, samples.length - 1));
  const point = samples[index];

  useEffect(() => {
    if (!playing || samples.length < 2) return;
    const timer = window.setInterval(() => setCursor((index) => Math.min(index + speed, samples.length - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [playing, samples.length, speed]);
  useEffect(() => {
    if (playing && cursor >= samples.length - 1) setPlaying(false);
  }, [cursor, playing, samples.length]);

  return (
    <section className="flight-history" aria-label="Historie zaznamenaných letů">
      <div className="flight-history-heading">
        <span className="eyebrow">B5 · FLIGHT RECORDER</span>
        <h2>Historie letů a přehrávání</h2>
        <p>Bridge ukládá body letu na Windows PC automaticky, i když není otevřený web.</p>
      </div>
      {error && <p className="telemetry-offline" role="status">{error}</p>}
      <section className="flight-history-backup">
        <h3>C49 · Záloha letového deníku</h3>
        <p>Exportujte všechny momentálně dostupné záznamy letů z Windows bridge do
          jednoho místního JSON souboru. Archiv může obsahovat GPS souřadnice,
          názvy letadel a časy letů. Neposílá se žádné externí službě.</p>
        <div className="flight-history-backup-actions">
          <button type="button" disabled={backupBusy||flights.length===0}
            onClick={()=>void exportBackup()}>
            {backupBusy?'Vytvářím zálohu…':'Zálohovat dostupné lety JSON'}
          </button>
          <label>Zkontrolovat existující zálohu (pouze lokální náhled)
            <input type="file" accept=".json,application/json"
              onChange={e=>{const file=e.currentTarget.files?.[0]??null;
                void inspectBackup(file);e.currentTarget.value='';}}/>
          </label>
        </div>
        {backupMessage&&<p role="status">{backupMessage}</p>}
        {backupPreview&&<p>Ověřený formát: {backupPreview.count} letů,
          {' '}{backupPreview.samples} vzorků,
          {' '}{backupPreview.mock} testovacích,
          {' '}{backupPreview.active} neukončených při zálohování.
          Datum exportu: {new Date(backupPreview.exportedAtUtc).toLocaleString('cs-CZ')}.</p>}
        <p>Původní Windows záznamy se nijak nemění. Import do aktivní historie
          zatím není podporovaný; limit archivů je 20 MB. Starší lety,
          které již bridge automaticky promazal, exportovat nelze.</p>
      </section>
      <div className="flight-history-layout">
        <aside className="flight-history-list" aria-label="Zaznamenané lety">
          {flights.length === 0 && <p>Zatím nebyl zaznamenán žádný let.</p>}
          {flights.map((flight) => (
            <button key={flight.id} type="button" className={flight.id === selected ? 'selected' : ''}
              onClick={() => { setSelected(flight.id); setDetail(null); setCursor(0); setPlaying(false); setComparison(null); }}>
              <strong>{flight.aircraft}</strong>
              <span>{timestamp(flight.startedAtUtc)}</span>
              <small>{flight.active ? '● Právě se zaznamenává' : elapsed(flight)}
                {flight.mode === 'mock' ? ' · TESTOVACÍ DATA' : ''}</small>
            </button>
          ))}
        </aside>
        <div className="flight-history-main">
          {!detail ? (
            <p className="flight-history-empty">Vyberte let v historii. Záznamy vznikají přibližně jednou za sekundu.</p>
          ) : (
            <>
              <div className="flight-history-summary">
                <div><span>Letadlo</span><strong>{detail.summary.aircraft}</strong></div>
                <div><span>Délka letu</span><strong>{elapsed(detail.summary)}</strong></div>
                <div><span>Vzdálenost</span><strong>{(detail.summary.distanceMeters / 1000).toFixed(1)} km</strong></div>
                <div><span>Vzorky</span><strong>{detail.summary.samples}</strong></div>
                <div><span>Max. IAS</span><strong>{Math.round(detail.summary.maxAirspeedKnots)} KT</strong></div>
                <div><span>Max. výška</span><strong>{Math.round(detail.summary.maxAltitudeFeet)} FT</strong></div>
              </div>

              <div className="flight-history-export">
                <button type="button" disabled={!samples.length} onClick={()=>download('csv')}>Export CSV</button>
                <button type="button" disabled={!samples.length} onClick={()=>download('gpx')}>Export GPX</button>
                <button type="button" disabled={!samples.length} onClick={()=>download('kml')}>Export KML</button>
                <span>Soubor zůstává v prohlížeči. Nedochází k odeslání do externí služby.</span>
              </div>
              <div className="flight-history-compare">
                <h3>C39 · Porovnání letů</h3>
                <label>Druhý let
                  <select value={compareId} onChange={e=>{setCompareId(e.target.value);setComparison(null);}}>
                    <option value="">Vyberte let…</option>
                    {flights.filter(f=>f.id!==detail.summary.id).map(f=>
                      <option key={f.id} value={f.id}>{f.aircraft} · {timestamp(f.startedAtUtc)}</option>)}
                  </select>
                </label>
                <button type="button" disabled={!compareId||compareBusy} onClick={()=>void compare()}>
                  {compareBusy?'Porovnávám…':'Porovnat'}
                </button>
                {comparison && <div className="flight-history-comparison">
                  {[detail,comparison].map(row=>{
                    const report=analyzeFlight(row.samples);
                    const touchdowns=report.events.filter(e=>e.kind==='touchdown');
                    const last=touchdowns.at(-1);
                    return <article key={row.summary.id}>
                      <strong>{row.summary.aircraft} · {timestamp(row.summary.startedAtUtc)}</strong>
                      <p>Délka: {(row.summary.distanceMeters/1000).toFixed(1)} km</p>
                      <p>Max. IAS: {row.summary.maxAirspeedKnots.toFixed(0)} KT</p>
                      <p>Dosednutí (SimVar): {touchdowns.length||'bez potvrzení'}</p>
                      <p>Poslední touchdown rate: {last?.touchdownRateFpm!=null
                        ? last.touchdownRateFpm.toFixed(0)+' FPM':'nezjištěna'}</p>
                      <p>Důvěryhodných onGround vzorků: {report.reliableGroundSamples}/{report.totalSamples}</p>
                    </article>;
                  })}
                </div>}
                <p>Porovnáváme lokální záznamy, nikoli kvalitu pilota. Zkrácené a starší lety
                  mohou mít chybějící údaje nebo nepřesné časy.</p>
              </div>
              <FlightInsights samples={samples} mode={detail.summary.mode} />
              <h3>Průběh výšky a rychlosti</h3>
              <FlightReplayCharts samples={samples} index={index} />

              <h3>Schéma proletěné trasy</h3>
              <FlightRouteMap samples={samples} selectedIndex={index} />

              <div className="flight-history-player">
                <button type="button" disabled={samples.length < 2} onClick={() => {
                  if (!playing && cursor >= samples.length - 1) setCursor(0);
                  setPlaying((v) => !v);
                }}>{playing ? 'Pozastavit' : '▶ Přehrát let'}</button>
                <input type="range" min="0" max={Math.max(samples.length - 1, 0)}
                  value={index} onChange={(event) => { setCursor(Number(event.target.value)); setPlaying(false); }}
                  aria-label="Poloha v záznamu letu" />
                <label className="flight-player-speed">Přehrávání
                  <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}>
                    <option value={1}>1 vzorek/s</option>
                    <option value={2}>2 vzorky/s</option>
                    <option value={4}>4 vzorky/s</option>
                  </select>
                </label>
                <span>{point ? timestamp(point.timestampUtc) : 'Žádná data'}</span>
              </div>

              <div className="flight-history-values">
                <span>IAS <strong>{point ? point.airspeedKnots.toFixed(0) : '—'} KT</strong></span>
                <span>ALT <strong>{point ? point.altitudeFeet.toFixed(0) : '—'} FT</strong></span>
                <span>HDG <strong>{point ? point.headingDegrees.toFixed(0) : '—'}°</strong></span>
                <span>GPS <strong>{point ? `${point.latitude.toFixed(4)}°, ${point.longitude.toFixed(4)}°` : '—'}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="flight-history-note">
        Historie je dostupná každému zařízení ve stejné důvěryhodné domácí podsíti.
        Záznamy se uchovávají na Windows PC (max. 30 letů / 100 MB) a obsahují polohu.
        Pro dlouhý let mohou být body při přehrávání převzorkované.
      </p>
    </section>
  );
}
