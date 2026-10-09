import type {TelemetrySnapshot} from '../telemetry/types';

export type ArchivedFlight={
 summary:{id:string;aircraft:string;mode:'mock'|'simconnect';
  startedAtUtc:string;lastAtUtc:string;endedAtUtc?:string|null;active:boolean};
 samples:TelemetrySnapshot[];
};
export type FlightArchive={
 schema:'kokpit-flight-backup-v1';exportedAtUtc:string;flights:ArchivedFlight[];
};
export const ARCHIVE_LIMIT_BYTES=20_000_000;
export const RESTORE_MAX_SAMPLES_PER_FLIGHT=4000;
const minYear=Date.parse('2000-01-01T00:00:00Z');
const maxYear=Date.parse('2101-01-01T00:00:00Z');
const finiteRange=(value:unknown,min:number,max:number):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const epoch=(value:unknown):number|null=>{
  if(typeof value!=='string'||value.length>50)return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&ms>=minYear&&ms<maxYear?ms:null;
};
const date=(x:unknown)=>epoch(x)!==null;
const validSample=(v:unknown):v is TelemetrySnapshot=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const s=v as Partial<TelemetrySnapshot>;
 return date(s.timestampUtc)&&typeof s.aircraft==='string'
  &&s.aircraft.trim().length>0&&s.aircraft.length<=200
  &&finiteRange(s.latitude,-90,90)&&finiteRange(s.longitude,-180,180)
  &&finiteRange(s.altitudeFeet,-3000,100000)
  &&finiteRange(s.airspeedKnots,0,1500)
  &&finiteRange(s.verticalSpeedFeetPerMinute,-30000,30000)
  &&typeof s.headingDegrees==='number'&&Number.isFinite(s.headingDegrees)
  &&typeof s.pitchDegrees==='number'&&Number.isFinite(s.pitchDegrees)
  &&typeof s.bankDegrees==='number'&&Number.isFinite(s.bankDegrees);
};
function validFlight(value:unknown):value is ArchivedFlight{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const f=value as Partial<ArchivedFlight>;
 const s=f.summary;
 return !!s&&typeof s==='object'&&!Array.isArray(s)
  &&typeof s.id==='string'&&/^\d{8}T\d{6}-[0-9a-f]{12}$/.test(s.id)
  &&typeof s.aircraft==='string'&&s.aircraft.length<=200
  &&(s.mode==='simconnect'||s.mode==='mock')
  &&date(s.startedAtUtc)&&date(s.lastAtUtc)&&date(s.endedAtUtc) && s.active===false
  &&epoch(s.lastAtUtc)!>=epoch(s.startedAtUtc)!
  &&epoch(s.lastAtUtc)!<=epoch(s.startedAtUtc)!+7*3600_000
  &&epoch(s.endedAtUtc)!>=epoch(s.lastAtUtc)!
  &&Array.isArray(f.samples)&&f.samples.length>=1
  &&f.samples.length<=RESTORE_MAX_SAMPLES_PER_FLIGHT
  &&f.samples.every(validSample)
  &&f.samples.every((item,index)=>{
    const sample=item as TelemetrySnapshot;
    const timestamp=epoch(sample.timestampUtc)!;
    return sample.aircraft===s.aircraft&&
      timestamp>=epoch(s.startedAtUtc)!-60000 &&
      timestamp<=epoch(s.lastAtUtc)!+60000 &&
      (index===0||timestamp>epoch((f.samples![index-1] as TelemetrySnapshot).timestampUtc)!);
  });
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
