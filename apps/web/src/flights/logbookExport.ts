import type { TelemetrySnapshot } from '../telemetry/types';

function xml(value: string): string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
type Position = {lat:number;lon:number;alt:number|null;time:string};
export function validFlightPositions(samples: TelemetrySnapshot[]): Position[] {
  return samples.slice(0,10000).flatMap(p=>{
    if (!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||
      Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||
      !Number.isFinite(Date.parse(p.timestampUtc))) return [];
    const alt = Number.isFinite(p.altitudeFeet) ? p.altitudeFeet*0.3048 : null;
    return [{lat:p.latitude,lon:p.longitude,alt,time:new Date(p.timestampUtc).toISOString()}];
  });
}
export function exportFlightGpx(samples: TelemetrySnapshot[],aircraft:string): string {
  const points=validFlightPositions(samples);
  if(!points.length) throw new Error('Záznam neobsahuje platné GPS body.');
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    +'<gpx version="1.1" creator="Kokpit MSFS Companion" xmlns="http://www.topografix.com/GPX/1/1">'
    +'<trk><name>'+xml(aircraft.slice(0,120))+'</name><trkseg>'
    +points.map(p=>'<trkpt lat="'+p.lat+'" lon="'+p.lon+'">'
      +(p.alt===null?'':'<ele>'+p.alt.toFixed(2)+'</ele>')
      +'<time>'+p.time+'</time></trkpt>').join('')
    +'</trkseg></trk></gpx>';
}
export function exportFlightKml(samples: TelemetrySnapshot[],aircraft:string): string {
  const points=validFlightPositions(samples);
  if(!points.length) throw new Error('Záznam neobsahuje platné GPS body.');
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    +'<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>'
    +xml(aircraft.slice(0,120))+'</name><LineString><tessellate>1</tessellate><coordinates>'
    +points.map(p=>p.lon+','+p.lat+','+(p.alt??0).toFixed(2)).join(' ')
    +'</coordinates></LineString></Placemark></Document></kml>';
}
