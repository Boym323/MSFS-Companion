import type {TelemetrySnapshot} from '../telemetry/types';
import {A320_TABS,a320PanelUrl} from './a320Tabs';
import './A320CompactStatus.css';

/** A concise read-only workspace tile. No duplicated A320 pollers or WASM
 * controls are mounted in a one/two-column custom cockpit workspace.
 */
export default function A320CompactStatus({telemetry,live}:{
 telemetry:TelemetrySnapshot|null;live:boolean
}){
 const aircraft=live?telemetry?.aircraft??null:null;
 const value=(n:number|null|undefined,unit:string)=>
  n!==null&&n!==undefined&&Number.isFinite(n)?
   Math.round(n).toLocaleString('cs-CZ')+' '+unit:'—';
 return <section className="a320-compact" aria-label="Airbus A320 – stručný přehled">
  <div className="a320-compact-head">
   <div><span>ASOBO A320NEO · KOKPIT</span><h3>Přístrojové centrum</h3></div>
   <span role="status">{aircraft?aircraft:'Čekám na živá data'}</span>
  </div>
  <dl className="a320-compact-readings">
   <div><dt>Rychlost IAS</dt><dd>{value(live?telemetry?.airspeedKnots:null,'KT')}</dd></div>
   <div><dt>Výška</dt><dd>{value(live?telemetry?.altitudeFeet:null,'FT')}</dd></div>
   <div><dt>Kurz</dt><dd>{value(live?telemetry?.headingDegrees:null,'°')}</dd></div>
   <div><dt>Vertikální rychlost</dt><dd>{value(live?telemetry?.verticalSpeedFeetPerMinute:null,'FPM')}</dd></div>
  </dl>
  <nav className="a320-compact-links" aria-label="Otevřít přístroj Airbus">
   {A320_TABS.filter(tab=>tab.id!=='diagnostics').map(tab=>
    <a key={tab.id} href={a320PanelUrl(tab.id)}>{tab.label} ↗</a>)}
  </nav>
  <p>Stručné hodnoty pocházejí ze standardní telemetrie. Stav původního
   Airbus FCU, FMS a WASM se ověřuje až na samostatné stránce.</p>
 </section>;
}
