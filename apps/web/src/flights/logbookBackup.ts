import type {TelemetrySnapshot} from '../telemetry/types';

export type ArchivedFlight={
 summary:{id:string;aircraft:string;mode:'mock'|'simconnect';
  startedAtUtc:string;lastAtUtc:string;active:boolean};
 samples:TelemetrySnapshot[];
};
export type FlightArchive={
 schema:'kokpit-flight-backup-v1';exportedAtUtc:string;flights:ArchivedFlight[];
};
export const ARCHIVE_LIMIT_BYTES=20_000_000;
const date=(x:unknown)=>typeof x==='string' && x.length<=50
  &&Number.isFinite(Date.parse(x));
const validSample=(v:unknown):v is TelemetrySnapshot=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const s=v as Partial<TelemetrySnapshot>;
 return date(s.timestampUtc)&&typeof s.aircraft==='string'&&s.aircraft.length<=200
  &&typeof s.latitude==='number'&&Number.isFinite(s.latitude)&&Math.abs(s.latitude)<=90
  &&typeof s.longitude==='number'&&Number.isFinite(s.longitude)&&Math.abs(s.longitude)<=180
  &&typeof s.altitudeFeet==='number'&&Number.isFinite(s.altitudeFeet)
  &&typeof s.airspeedKnots==='number'&&Number.isFinite(s.airspeedKnots);
};
function validFlight(value:unknown):value is ArchivedFlight{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const f=value as Partial<ArchivedFlight>;
 const s=f.summary;
 return !!s&&typeof s==='object'&&!Array.isArray(s)
  &&typeof s.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(s.id)
  &&typeof s.aircraft==='string'&&s.aircraft.length<=200
  &&(s.mode==='simconnect'||s.mode==='mock')
  &&date(s.startedAtUtc)&&date(s.lastAtUtc)&&typeof s.active==='boolean'
  &&Array.isArray(f.samples)&&f.samples.length<=10000&&f.samples.every(validSample);
}
export function createLogbookArchive(flights:ArchivedFlight[],exportedAtUtc:string):string{
 if(flights.some(f=>f?.summary?.active===true))throw Error('Aktivní let nelze uložit do obnovitelné zálohy. Ukončete let a export zopakujte.');
 if(flights.length>30||!date(exportedAtUtc))throw Error('Neplatná velikost nebo datum zálohy.');
 if(flights.some(f=>!validFlight(f)))
   throw Error('Některý záznam letu má neplatné údaje.');
 if(new Set(flights.map(f=>f.summary.id)).size!==flights.length)
   throw Error('Záloha obsahuje duplicitní let.');
 const serialized=JSON.stringify({schema:'kokpit-flight-backup-v1',
   exportedAtUtc,flights} satisfies FlightArchive);
 if(new TextEncoder().encode(serialized).length>ARCHIVE_LIMIT_BYTES)
   throw Error('Záloha přesahuje limit 20 MB; exportujte lety jednotlivě.');
 return serialized;
}
export function inspectLogbookArchive(raw:string):{
  count:number;samples:number;mock:number;active:number;exportedAtUtc:string
}{
 if(new TextEncoder().encode(raw).length>ARCHIVE_LIMIT_BYTES)
   throw Error('Soubor zálohy je příliš velký.');
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw Error('Soubor není platné JSON.');}
 if(!value||typeof value!=='object'||Array.isArray(value))
   throw Error('Neznámý formát zálohy.');
 const doc=value as Partial<FlightArchive>;
 if(doc.schema!=='kokpit-flight-backup-v1'||!date(doc.exportedAtUtc)
  ||!Array.isArray(doc.flights)||doc.flights.length>30)
   throw Error('Neznámé schéma nebo nadměrný počet letů.');
 if(!doc.flights.every(validFlight))
   throw Error('Záloha obsahuje neúplná nebo neplatná letová data.');
 const ids=doc.flights.map(f=>f.summary.id);
 if(new Set(ids).size!==ids.length)throw Error('Záloha obsahuje duplicitní lety.');
 return {count:doc.flights.length,
  samples:doc.flights.reduce((sum,f)=>sum+f.samples.length,0),
  mock:doc.flights.filter(f=>f.summary.mode==='mock').length,
  active:doc.flights.filter(f=>f.summary.active).length,
  exportedAtUtc:doc.exportedAtUtc!};
}
