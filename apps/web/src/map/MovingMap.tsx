import { useEffect, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import {
  metersBetween, project, shortestWorldDistance,
} from './geo';
import MapTileLayer from './MapTileLayer';
import { useFlightNavigation, FlightNavigationPanel } from './FlightNavigation';
import { parsePln, type ImportedWaypoint } from './pln';
import { SESSION_KEY } from '../planning/FlightPlanner';
import { useAviationFeatures } from './useAviationFeatures';
import { useVatsimMapLayer } from './useVatsimMapLayer';
import useSigmet from './useSigmet';
import {useSimTraffic} from './useSimTraffic';
import {relativeTraffic} from './relativeTraffic';
import {parseOpenAir, type Airspace} from './openAir';
import {groundQuery,parseGroundMap,type GroundMap} from './groundMap';
import {comparePlan} from './planCrosscheck';
import AviationAirportDetails from './AviationAirportDetails';
import AirportSearch from './AirportSearch';
import { useMapBackground } from './useMapBackground';
import './MovingMap.css';

type TrackPoint = {
  latitude: number;
  longitude: number;
  receivedAt: number;
  aircraft: string;
};

const MAX_POINTS = 3600; // ~1h při 1 bodu/s; žádná neomezená paměť

export default function MovingMap({ telemetry }: { telemetry: TelemetrySnapshot | null }) {
  const [zoom, setZoom] = useState(11);
  const [showLeg, setShowLeg] = useState(true);
  const [showAviation, setShowAviation] = useState(true);
  const [showRunways, setShowRunways] = useState(true);
  const [showNavaids, setShowNavaids] = useState(true);
  const [showVatsim, setShowVatsim] = useState(false);
  const [showSigmet, setShowSigmet] = useState(false);
  const [showSimTraffic, setShowSimTraffic] = useState(false);
  const [airspaces,setAirspaces] = useState<Airspace[]>([]);
  const [showAirspaces,setShowAirspaces] = useState(false);
  const [airspaceMessage,setAirspaceMessage] = useState('');
  const [czechLoading,setCzechLoading] = useState(false);
  async function loadCzechAirspace() {
    if(czechLoading) return;
    setCzechLoading(true);setAirspaceMessage('Načítám veřejná česká data Aeroklubu ČR…');
    try {
      const response=await fetch('/api/airspace/czechia',{cache:'no-store'});
      if(!response.ok) throw Error('České prostory nejsou dostupné.');
      const payload=await response.json() as {
        available:boolean;stale:boolean;effectiveDate:string;
        source:string;data:string|null;error?:string|null;
      };
      if(!payload.available||!payload.data) throw Error(payload.error||'Zdroj není dostupný.');
      const parsed=parseOpenAir(payload.data);
      setAirspaces(parsed.regions);setShowAirspaces(true);
      setAirspaceMessage('Aeroklub ČR · platnost zdrojového souboru od '+
        payload.effectiveDate+' · '+parsed.regions.length+' polygonů, '+
        parsed.skipped+' přeskočených (neplatná či složitá geometrie). '+
        (payload.stale?'Mezipaměť je zastaralá. ':'')+
        'Není ověřena aktuální aktivace prostorů ani NOTAM.');
    } catch (error) {setAirspaceMessage(error instanceof Error?error.message:'Nepodařilo se načíst letecké prostory.');}
    finally {setCzechLoading(false);}
  }
  const [ground,setGround] = useState<GroundMap | null>(null);
  const [groundOrigin,setGroundOrigin] = useState<{latitude:number;longitude:number}|null>(null);
  const [groundMessage,setGroundMessage] = useState('');
  const [groundLoading,setGroundLoading] = useState(false);
  const [showGround,setShowGround] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const aviation = useAviationFeatures(showAviation, telemetry?.latitude ?? null,
    telemetry?.longitude ?? null, zoom);
  const vatsim = useVatsimMapLayer(showVatsim,
    telemetry?.latitude ?? null, telemetry?.longitude ?? null, zoom);
  const sigmet = useSigmet(showSigmet,telemetry?.latitude??null,telemetry?.longitude??null);
  const simTraffic = useSimTraffic(showSimTraffic&&!!telemetry);
  const navigation = useFlightNavigation(!!telemetry);
  const [importedPlan, setImportedPlan] = useState<ImportedWaypoint[]>(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return [];
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data) || data.length > 400) return [];
      return data.filter((point): point is ImportedWaypoint => point !== null &&
        typeof point === 'object' &&
        typeof point.id === 'string' && point.id.length <= 32 &&
        typeof point.latitude === 'number' && Number.isFinite(point.latitude) &&
        Math.abs(point.latitude) <= 85.05 &&
        typeof point.longitude === 'number' && Number.isFinite(point.longitude) &&
        Math.abs(point.longitude) <= 180);
    } catch { return []; }
  });
  const [planMessage, setPlanMessage] = useState('');
  const [tilesEnabled, setTilesEnabled] = useMapBackground();
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [size, setSize] = useState({ width: 920, height: 500 });
  const viewport = useRef<HTMLDivElement>(null);
  const lastPoint = useRef<TrackPoint | null>(null);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.max(320, Math.round(rect.width)), height: Math.max(260, Math.round(rect.height)) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!telemetry) return;
    const timestamp = Date.parse(telemetry.timestampUtc);
    if (!Number.isFinite(timestamp) || Math.abs(telemetry.latitude) > 85.05
      || Math.abs(telemetry.longitude) > 180) return;
    const point = {
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      receivedAt: timestamp,
      aircraft: telemetry.aircraft,
    };
    const last = lastPoint.current;
    if (last && timestamp <= last.receivedAt) return;
    // Neukládat všech 20 Hz: trasa nepotřebuje jemnější stopu než 1 Hz.
    if (last && last.aircraft === point.aircraft
      && timestamp - last.receivedAt < 1000) return;
    if (last && last.aircraft !== point.aircraft) {
      setTrack([point]);
    } else if (last && metersBetween(last, point) > 100000) {
      // Skok přes polovinu země po přesunu letadla nespojuj čarou.
      setTrack([point]);
    } else {
      setTrack((before) => [...before.slice(-(MAX_POINTS - 1)), point]);
    }
    lastPoint.current = point;
  }, [telemetry]);

  const center = telemetry ?? track[track.length - 1];
  const validCenter = center && Math.abs(center.latitude) <= 85.05
    && Math.abs(center.longitude) <= 180;
  const world = validCenter ? project(center, zoom) : null;
  const { width, height } = size;
  const trackPath = world && track.length >= 2
    ? track.map((point, index) => {
        const p = project(point, zoom);
        const x = shortestWorldDistance(p.x, world.x, zoom) + width / 2;
        const y = p.y - world.y + height / 2;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : '';
  const mapPosition = (point: { latitude: number; longitude: number }) => {
    if (!world || Math.abs(point.latitude) > 85.05 || Math.abs(point.longitude) > 180) return null;
    const projected = project(point, zoom);
    return { x: shortestWorldDistance(projected.x, world.x, zoom) + width / 2,
      y: projected.y - world.y + height / 2 };
  };
  const importedPath = importedPlan.map((point, index) => {
    const p = mapPosition(point);
    return p ? `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : '';
  }).filter(Boolean).join(' ');
  const nextXY = navigation?.waypointActive && navigation.nextWaypoint
    ? mapPosition(navigation.nextWaypoint) : null;
  const fromXY = navigation?.waypointActive && navigation.previousWaypoint
    ? mapPosition(navigation.previousWaypoint)
    : telemetry ? mapPosition(telemetry) : null;
  const planCheck=comparePlan(importedPlan,navigation);
  const groundValid=!!(ground&&groundOrigin&&telemetry
    && metersBetween(groundOrigin,telemetry)<3500);
  async function loadGround(){
    if(!telemetry||groundLoading||zoom<13)return;
    setGroundLoading(true);setGroundMessage('Načítám mapované pojezdové cesty z OSM…');
    const origin={latitude:telemetry.latitude,longitude:telemetry.longitude};
    const cancel=new AbortController();
    const timeout=window.setTimeout(()=>cancel.abort(),18000);
    try{
      const query=groundQuery(origin.latitude,origin.longitude);
      const response=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query),
        {signal:cancel.signal,cache:'no-store'});
      if(!response.ok)throw Error('OSM server není dostupný.');
      const payload=await response.text();
      if(payload.length>2_000_000)throw Error('OSM odpověď je příliš velká.');
      const parsed=parseGroundMap(JSON.parse(payload));
      setGround(parsed);setGroundOrigin(origin);setShowGround(true);
      setGroundMessage('OSM: '+parsed.ways.length+' úseků pojíždění, '+parsed.holding.length+' vyčkávacích pozic. Neověřená komunitní data.');
    }catch{setGroundMessage('OSM pojezdové cesty se nepodařilo načíst. Zkuste později.');}
    finally{window.clearTimeout(timeout);setGroundLoading(false);}
  }
  const nearbyTraffic=showSimTraffic && telemetry && simTraffic.available && !simTraffic.stale
    ? relativeTraffic(telemetry,simTraffic.targets) : [];
  const distance = track.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + metersBetween(track[index - 1], point);
  }, 0);

  return (
    <section className="moving-map" aria-label="Pohyblivá mapa letu">
      <div className="moving-map-header">
        <div>
          <span className="eyebrow">B4 · MOVING MAP</span>
          <h2>Poloha a proletěná trasa</h2>
          <p>Letadlo je uprostřed, mapa zůstává orientovaná na sever.</p>
        </div>
        <div className="moving-map-controls">
          <button type="button" onClick={() => setZoom((z) => Math.max(6, z - 1))}
            aria-label="Oddálit mapu">−</button>
          <strong>ZOOM {zoom}</strong>
          <button type="button" onClick={() => setZoom((z) => Math.min(15, z + 1))}
            aria-label="Přiblížit mapu">+</button>
          <button type="button" className="moving-map-clear" onClick={() => {
            setTrack([]);
            lastPoint.current = null;
          }}>Smazat stopu</button>
        </div>
      </div>

      <label className="moving-map-background">
        <input type="checkbox" checked={tilesEnabled}
          onChange={(event) => setTilesEnabled(event.target.checked)} />
        Podklad OpenStreetMap (automaticky zapnutý, lze vypnout)
      </label>

      <label className="moving-map-background">
        <input type="checkbox" checked={showSigmet}
          onChange={event=>setShowSigmet(event.target.checked)} />
        SIGMET počasí NOAA (informativní výstrahy)
      </label>
      {showSigmet && <p role="status" className="moving-map-sigmet-status">
        {sigmet.available ? `SIGMET: ${sigmet.hazards.length} polygonů v okolí` : 'SIGMET se načítají nebo nejsou dostupné'}
        {sigmet.stale?' · Starší údaje':''}
        {sigmet.error?' · '+sigmet.error:''}
      </p>}
      <label className="moving-map-background">
        <input type="checkbox" checked={showSimTraffic}
          onChange={event=>setShowSimTraffic(event.target.checked)} />
        Letadla z MSFS (nativní SimConnect · experimentální)
      </label>
      {showSimTraffic&&<>
        <p className="moving-map-traffic-status" role="status">
          {simTraffic.available&&!simTraffic.stale
            ? `MSFS: ${simTraffic.targets.length} potvrzených objektů v okolí`
            : 'MSFS provoz nepotvrzen – čekám na odpověď SimConnectu.'}
          {simTraffic.stale?' · Starší data byla skryta':''}
          {' · '}{simTraffic.status}
        </p>
        {nearbyTraffic.length>0&&<section className="moving-map-relative-traffic"
          aria-label="Nejbližší provoz v MSFS">
          <h3>C46 · Nejbližší provoz</h3>
          <ul>{nearbyTraffic.map(target=><li key={target.objectId}>
            <strong>AI #{target.objectId}</strong>
            <span>{target.distanceNm.toFixed(1)} NM</span>
            <span>{target.side} · {target.bearingTrue}° zeměpisně</span>
            <span>{target.altitudeDifferenceFeet>=0?'+':''}{target.altitudeDifferenceFeet} ft</span>
            {target.onGround&&<span>Na zemi</span>}
          </li>)}</ul>
          <p>Pouze orientační pozice z MSFS. Není to TCAS, predikce srážek
            ani potvrzení všech multiplayerových objektů.</p>
        </section>}
      </>}
      <label className="moving-map-background">
        <input type="checkbox" checked={showVatsim}
          onChange={event => setShowVatsim(event.target.checked)} />
        VATSIM online letadla (volitelně, NEJSOU to letadla v MSFS)
      </label>
      {showVatsim && <p className="moving-map-vatsim-status" role="status">
        {vatsim.available
          ? `VATSIM: ${vatsim.pilots.length} online pilotů v okolí`
          : 'VATSIM se načítá nebo není dostupný.'}
        {vatsim.stale ? ' · Starší data' : ''}
        {vatsim.updatedAt ? ` · ${new Date(vatsim.updatedAt).toLocaleTimeString('cs-CZ')}` : ''}
        {vatsim.error ? ` · ${vatsim.error}` : ''}
      </p>}
      <label className="moving-map-background"><input type="checkbox" checked={showLeg}
        onChange={event => setShowLeg(event.target.checked)} /> Zobrazit aktivní GPS úsek a waypoint</label>
      <label className="moving-map-background">
        <input type="checkbox" checked={showAviation} onChange={e => setShowAviation(e.target.checked)} />
        Letiště / VOR / NDB z OurAirports (internet, bez další instalace)
      </label>
      {showAviation && <>
        <div className="moving-map-aviation-options">
          <label><input type="checkbox" checked={showRunways}
            onChange={event => setShowRunways(event.target.checked)} /> Dráhy</label>
          <label><input type="checkbox" checked={showNavaids}
            onChange={event => setShowNavaids(event.target.checked)} /> VOR / NDB / DME</label>
        </div>
        <p className="moving-map-layer-status" role="status">
          {aviation.loading && !aviation.available ? 'Načítám leteckou databázi OurAirports. První stažení může chvíli trvat…'
            : aviation.available ? `Zobrazuji ${aviation.features.length} leteckých objektů z OurAirports`
            : 'Letecká databáze zatím není dostupná. Mapa a GPS fungují dál.'}
          {aviation.stale ? ' · Offline cache (starší data)' : ''}
          {aviation.available && aviation.updatedAt
            ? ` · Data: ${new Date(aviation.updatedAt).toLocaleDateString('cs-CZ')}` : ''}
        </p>
      </>}
      <div className="moving-map-airspace-import">
        <button type="button" disabled={czechLoading} onClick={()=>void loadCzechAirspace()}>
          {czechLoading?'Načítám…':'Načíst české vzdušné prostory (Aeroklub ČR)'}
        </button>
        <label>Vzdušné prostory · ruční import OpenAir (C35)
          <input type="file" accept=".txt,.openair,text/plain" onChange={event=>{
            const file=event.currentTarget.files?.[0];if(!file)return;
            if(file.size>2_000_000){setAirspaceMessage('Soubor je větší než 2 MB.');return;}
            void file.text().then(text=>{
              const result=parseOpenAir(text);
              setAirspaces(result.regions);setShowAirspaces(true);
              setAirspaceMessage('Import: '+result.regions.length+' polygonů; '+result.skipped+
                ' nepodporovaných (například oblouky).');
            }).catch(()=>setAirspaceMessage('Soubor OpenAir nelze načíst.'));
          }}/>
        </label>
        <label><input type="checkbox" checked={showAirspaces} onChange={e=>setShowAirspaces(e.target.checked)}
          disabled={!airspaces.length}/> Zobrazit načtené prostory ({airspaces.length})</label>
        {airspaceMessage&&<p role="status">{airspaceMessage}</p>}
        <p>Podklady nejsou automaticky aktuální. Exporty ve formátu OpenAir lze získat
          například z <a href="https://openflightmaps.org/" target="_blank" rel="noreferrer">open flightmaps</a>.
          Podporované oblouky a kružnice se aproximují; neplatné tvary se vynechají.</p>
      </div>
      <div className="moving-map-ground-tools">
        <button type="button" disabled={!telemetry||groundLoading||zoom<13}
          onClick={()=>void loadGround()}>{groundLoading?'Načítám…':'Načíst pojezdové cesty OSM (C36)'}</button>
        <label><input type="checkbox" checked={showGround} disabled={!groundValid}
          onChange={e=>setShowGround(e.target.checked)}/> Zobrazit pojezdové cesty</label>
        <p role="status">{zoom<13?'Pro zobrazení pojezdových cest přibližte na zoom 13–15.':groundMessage}</p>
      </div>
      <div className="moving-map-pln">
        <label>Volitelně načíst kompletní plán ze souboru .PLN
          <input type="file" accept=".pln,.xml,text/xml,application/xml" onChange={event => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            void file.text().then(text => {
              const points = parsePln(text);
              setImportedPlan(points);
              window.sessionStorage.removeItem(SESSION_KEY);
              setPlanMessage(`Načteno ${points.length} waypointů ze souboru. Plán se automaticky nesynchronizuje s MSFS.`);
            }).catch(error => {
              setImportedPlan([]);
              setPlanMessage(error instanceof Error ? error.message : 'PLN soubor nelze načíst.');
            });
          }} />
        </label>
        {importedPlan.length > 0 && <button type="button" onClick={() => {
          setImportedPlan([]); setPlanMessage('Importovaná trasa smazána.');
        }}>Odebrat importovanou trasu</button>}
        {planMessage && <p role="status">{planMessage}</p>}
      </div>
      <div ref={viewport} className="moving-map-canvas" aria-label="Mapa centrovaná na aktuální GPS polohu">
        <MapTileLayer center={world} zoom={zoom} width={width} height={height} enabled={tilesEnabled} />
        <svg className="moving-map-track" viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none" aria-hidden="true">
          {showAviation && aviation.features.map((feature, index) => {
            if (feature.type === 'runway') {
              if (!showRunways || feature.endLatitude == null || feature.endLongitude == null)
                return null;
              const start = mapPosition(feature);
              const end = mapPosition({ latitude: feature.endLatitude,
                longitude: feature.endLongitude });
              return start && end ? <line key={'rwy-' + index}
                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke="#ffd39a" strokeWidth={zoom >= 12 ? 4 : 2}
                strokeLinecap="round" opacity=".85" /> : null;
            }
            if (!showNavaids && feature.type !== 'airport') return null;
            const pt = mapPosition(feature);
            if (!pt) return null;
            return <g key={feature.type + '-' + feature.ident + '-' + index}>
              <circle cx={pt.x} cy={pt.y} r={feature.type === 'airport' ? 5 : 3}
                fill={feature.type === 'airport' ? '#93e3ca' : feature.type === 'vor' ? '#e7adfb' : '#f6b6e8'}
                stroke="#14263a" strokeWidth="2" />
              {feature.type === 'airport' && zoom >= 9 && <text x={pt.x + 8} y={pt.y - 7}
                fill="#c7f1e2" stroke="#13283d" strokeWidth="2" paintOrder="stroke"
                fontSize="11">{feature.ident}</text>}
            </g>;
          })}
          {showAirspaces && airspaces.map((space,index)=>{
            const positions=space.points.map(mapPosition);
            if(positions.some(p=>!p))return null;
            const d=positions.map((p,i)=>(i?'L':'M')+' '+p!.x.toFixed(1)+' '+p!.y.toFixed(1)).join(' ')+' Z';
            return <path key={'airspace-'+index} d={d} fill="#64a7e0" fillOpacity=".10"
              stroke="#65b4ef" strokeWidth="1.5" strokeDasharray="8 4">
              <title>{space.name+' · '+space.category+' · '+space.lower+' až '+space.upper}</title>
            </path>;
          })}
          {showGround && groundValid && zoom>=13 && ground?.ways.map(way=>{
            const positions=way.points.map(mapPosition);
            if(positions.some(p=>!p))return null;
            const d=positions.map((p,i)=>(i?'L':'M')+' '+p!.x.toFixed(1)+' '+p!.y.toFixed(1)).join(' ');
            return <path key={'taxiway-'+way.id} d={d} fill="none"
              stroke={way.kind==='taxiway'?'#efc46b':'#b2c4a7'} strokeWidth="3" strokeLinecap="round">
              <title>{way.kind+' '+way.ref+' (OpenStreetMap, neověřeno)'}</title>
            </path>;
          })}
          {showGround && groundValid && zoom>=13 && ground?.holding.map((hold,i)=>{
            const p=mapPosition(hold);
            return p?<circle key={'hold-'+i} cx={p.x} cy={p.y} r="4"
              fill="#ff7f65" stroke="#471b23" strokeWidth="2">
              <title>Vyčkávací pozice · OSM</title></circle>:null;
          })}
          {showSigmet && sigmet.hazards.map((hazard,index)=>{
            const positions=hazard.boundary.map(point=>mapPosition(point));
            if(positions.some(p=>!p))return null;
            const d=positions.map((p,i)=>(i?'L':'M')+' '+p!.x.toFixed(1)+' '+p!.y.toFixed(1)).join(' ')+' Z';
            return <path key={'sigmet-'+index} d={d}
              fill="#e7a45a" fillOpacity=".16" stroke="#eab37b"
              strokeOpacity=".85" strokeWidth="2" strokeDasharray="6 5">
              <title>{hazard.description}</title>
            </path>;
          })}
          {showSimTraffic && simTraffic.available && !simTraffic.stale && simTraffic.targets.map(plane=>{
            const pos=mapPosition(plane);
            if(!pos||pos.x < -30||pos.x > width+30||pos.y < -30||pos.y > height+30)return null;
            return <g key={'msfs-'+plane.objectId}>
              <circle cx={pos.x} cy={pos.y} r="6" fill="#a1f0b9"
                stroke="#113d30" strokeWidth="2"/>
              {zoom>=11&&<text x={pos.x+9} y={pos.y-6}
                fill="#b7ffcc" stroke="#18332a" strokeWidth="2"
                paintOrder="stroke" fontSize="10">{'AI #'+plane.objectId}</text>}
              <title>SimObject #{plane.objectId}, {Math.round(plane.altitudeFeet)} ft</title>
            </g>;
          })}
          {showVatsim && vatsim.pilots.map(pilot => {
            const pt = mapPosition(pilot);
            if (!pt || pt.x < -30 || pt.x > width + 30 || pt.y < -30 || pt.y > height + 30)
              return null;
            return <g key={pilot.callsign}>
              <path
                d={`M ${pt.x.toFixed(1)} ${(pt.y-7).toFixed(1)} L ${(pt.x+6).toFixed(1)} ${(pt.y+6).toFixed(1)} L ${pt.x.toFixed(1)} ${(pt.y+3).toFixed(1)} L ${(pt.x-6).toFixed(1)} ${(pt.y+6).toFixed(1)} Z`}
                fill="#f19dc1" stroke="#2e1937" strokeWidth="1.5"
                transform={`rotate(${pilot.heading} ${pt.x} ${pt.y})`} />
              {zoom >= 10 && <text x={pt.x + 10} y={pt.y - 5}
                fill="#ffe0f0" stroke="#251c37" strokeWidth="2" paintOrder="stroke"
                fontSize="11">{pilot.callsign}</text>}
            </g>;
          })}
          {importedPath && <path d={importedPath} stroke="#bca5ff" strokeWidth="2.5"
            strokeDasharray="4 6" fill="none" />}
          {importedPlan.map((point, index) => {
            const location = mapPosition(point);
            return location ? <circle key={index} cx={location.x} cy={location.y}
              r="4" stroke="#453773" strokeWidth="1" fill="#bca5ff" /> : null;
          })}
          {showLeg && nextXY && fromXY && <path
            d={`M ${fromXY.x.toFixed(1)} ${fromXY.y.toFixed(1)} L ${nextXY.x.toFixed(1)} ${nextXY.y.toFixed(1)}`}
            stroke="#f9d978" strokeDasharray="9 7" fill="none" strokeWidth="3" />}
          {showLeg && nextXY && <>
            <circle cx={nextXY.x} cy={nextXY.y} r="7" fill="#f9d978" stroke="#111c2b" strokeWidth="2" />
            <text x={nextXY.x + 11} y={nextXY.y - 10} fill="#ffeaa8" stroke="#152235"
              strokeWidth="2.5" paintOrder="stroke" fontSize="14" fontWeight="700">
              {navigation?.nextWaypointId ?? 'GPS WP'}
            </text>
          </>}
          <path d={trackPath} stroke="#79e6f8" fill="none"
            strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {world && track.length > 0 && (() => {
            const first = project(track[0], zoom);
            const x = shortestWorldDistance(first.x, world.x, zoom) + width / 2;
            const y = first.y - world.y + height / 2;
            return <circle cx={x} cy={y} r="5" fill="#9cf5c1" stroke="#092033" strokeWidth="2" />;
          })()}
        </svg>
        {telemetry && validCenter && (
          <div className="moving-map-plane" style={{ transform: `translate(-50%, -50%) rotate(${telemetry.headingDegrees}deg)` }}>
            <svg width="54" height="58" viewBox="0 0 54 58" aria-hidden="true">
              <path d="M 27 2 L 32 22 L 50 34 L 50 40 L 31 35 L 31 49 L 39 54 L 39 57 L 27 53 L 15 57 L 15 54 L 23 49 L 23 35 L 4 40 L 4 34 L 22 22 Z"
                fill="#f8d478" stroke="#101c2b" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div className="moving-map-compass" aria-hidden="true">N ↑</div>
        {!telemetry && (
          <div className="moving-map-offline" role="status">
            <strong>Čekám na aktuální polohu letadla</strong>
            <span>Proletěná trasa zůstane zachována po dobu otevření této stránky.</span>
          </div>
        )}

      </div>
      {showSimTraffic && <p className="moving-map-traffic-legend">
        <span aria-hidden="true">●</span> Zelené značky = objekty skutečně
        vrácené SimConnectem. Nemusí zahrnovat veškerý multiplayer ani AI provoz.
      </p>}
      {showVatsim && vatsim.available && <p className="moving-map-vatsim-legend">
        <span aria-hidden="true">▲</span> Růžové značky = síť VATSIM (nikoli MSFS AI/provoz v simulátoru).
        Poloha i výška se mohou oproti skutečné scéně lišit.
        {' '}<a href="/vatsim">Otevřít přehled VATSIM</a>
      </p>}
      {showAviation && <AirportSearch onSelect={setSelectedAirport} />}
      {showAviation && aviation.available && <>
        <div className="moving-map-airports">
          <strong>Nejbližší letiště</strong>
          <div className="moving-map-airport-buttons">
            {aviation.features.filter(f => f.type === 'airport').slice(0, 8).map(a =>
              <button key={a.ident} type="button"
                onClick={() => setSelectedAirport(a.ident)}>
                {a.ident} · {a.name}
              </button>)}
          </div>
        </div>
      </>}
      {showAviation && selectedAirport && <AviationAirportDetails ident={selectedAirport}
        onClose={() => setSelectedAirport(null)} />}
      <FlightNavigationPanel navigation={navigation} />
      <p className="moving-map-plan-match" role="status">
        C37 · Porovnání plánu s GPS: {planCheck.description}
        {' '}Importovaný plán nikdy neodesíláme do avioniky.
      </p>
      {importedPlan.length > 0 && <div className="moving-map-imported">
        <strong>Importovaný plán .PLN / SimBrief ({importedPlan.length} waypointů):</strong>
        <span>{importedPlan.map(point => point.id).join(' → ')}</span>
      </div>}
      <div className="moving-map-stats">
        <span><strong>GPS:</strong> {telemetry
          ? `${telemetry.latitude.toFixed(5)}°, ${telemetry.longitude.toFixed(5)}°`
          : 'čekám'}</span>
        <span><strong>Směr:</strong> {telemetry ? `${telemetry.headingDegrees.toFixed(0)}°` : '—'}</span>
        <span><strong>Délka stopy:</strong> {(distance / 1000).toFixed(1)} km</span>
        <span><strong>Uložené body:</strong> {track.length} / {MAX_POINTS}</span>
      </div>
      <p className="moving-map-note">
        Podklad OpenStreetMap se načítá automaticky, pokud je dostupný internet.
        Bez internetu zůstane viditelná souřadnicová mřížka a stopa letu. Mapový server
        může odvodit přibližnou zobrazenou oblast z požadovaných dlaždic.
        Podklad lze vypnout; volba platí i pro historii letů.
      </p>
    </section>
  );
}
