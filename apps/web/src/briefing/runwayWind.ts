import type { AirportDetail } from '../map/useAviationFeatures';

export type MetarWind = {direction:number|null; speedKnots:number; gustKnots:number|null; calm:boolean};
export type RunwayWind = {
  ident:string; trackTrue:number; headwindKnots:number; crosswindKnots:number;
  gustHeadwindKnots:number|null; gustCrosswindKnots:number|null;
};

export function parseMetarWind(raw:string,airport:string):MetarWind|null {
  if(!/^[A-Z]{4}$/.test(airport)||raw.length>8000)return null;
  // NOAA raw METAR can begin with the report type, but must match the chosen airport.
  const clean=raw.trim().replace(/\s+/g,' ');
  const words=clean.split(' ');
  const first=words[0]==='METAR'||words[0]==='SPECI'?1:0;
  if(words[first]!==airport)return null;
  // Avoid remarks and a stray wind-like string later in the report.
  const body=words.slice(first+1,Math.min(first+13,words.length));
  const rm=body.indexOf('RMK');
  const tokens=rm>=0?body.slice(0,rm):body;
  const token=tokens.find(v=>/^(?:[0-3]\d{2}|VRB)\d{2,3}(?:G\d{2,3})?KT$/.test(v));
  if(!token)return null;
  const matched=/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/.exec(token);
  if(!matched)return null;
  const speed=Number(matched[2]),gust=matched[3]===undefined?null:Number(matched[3]);
  const direction=matched[1]==='VRB'?null:Number(matched[1]);
  if(speed>150 || (gust!==null&&(gust<speed||gust>200))
    || (direction!==null&&direction>360)
    || (direction===0 && speed>0))return null;
  return {direction:direction===360?0:direction, speedKnots:speed,
    gustKnots:gust, calm:speed===0};
}

function bearingTrue(aLat:number,aLon:number,bLat:number,bLon:number):number|null{
  if(![aLat,aLon,bLat,bLon].every(Number.isFinite) ||
    Math.abs(aLat)>85.05||Math.abs(bLat)>85.05 ||
    Math.abs(aLon)>180||Math.abs(bLon)>180)return null;
  const deltaLat=bLat-aLat;
  const deltaLon=((bLon-aLon+540)%360)-180;
  if(Math.abs(deltaLat)<1e-7&&Math.abs(deltaLon)<1e-7)return null;
  const rad=Math.PI/180, lon=deltaLon*rad;
  const x=Math.sin(lon)*Math.cos(bLat*rad);
  const y=Math.cos(aLat*rad)*Math.sin(bLat*rad)
    -Math.sin(aLat*rad)*Math.cos(bLat*rad)*Math.cos(lon);
  return (Math.atan2(x,y)/rad+360)%360;
}

export function calculateRunwayWind(
  runways:AirportDetail['runways'],wind:MetarWind
):RunwayWind[]{
  if(wind.direction===null&&!wind.calm)return [];
  const result:RunwayWind[]=[];
  for(const runway of runways.slice(0,20)){
    const track=bearingTrue(runway.latitude,runway.longitude,
      runway.endLatitude,runway.endLongitude);
    if(track===null)continue;
    for(const [ident,heading] of [[runway.lowIdent,track],
      [runway.highIdent,(track+180)%360]] as [string,number][]){
      if(!/^(0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(ident))continue;
      const radians=((wind.direction??0)-heading)*Math.PI/180;
      const head=wind.calm?0:wind.speedKnots*Math.cos(radians);
      const cross=wind.calm?0:wind.speedKnots*Math.sin(radians);
      result.push({ident,trackTrue:Math.round(heading),
        headwindKnots:Math.round(head*10)/10,
        crosswindKnots:Math.round(cross*10)/10,
        gustHeadwindKnots:wind.gustKnots===null?null:
          Math.round(wind.gustKnots*Math.cos(radians)*10)/10,
        gustCrosswindKnots:wind.gustKnots===null?null:
          Math.round(wind.gustKnots*Math.sin(radians)*10)/10});
    }
  }
  return result.sort((a,b)=>b.headwindKnots-a.headwindKnots).slice(0,40);
}

export function freshMetarWind(
  metar:string|null,airport:string,fetchedAt:string,available:boolean,
  stale:boolean, nowMs:number,
):MetarWind|null{
  const updated=Date.parse(fetchedAt);
  if(!metar||!available||stale||!Number.isFinite(updated)
    ||updated>nowMs+60_000||nowMs-updated>2*60*60*1000)return null;
  return parseMetarWind(metar,airport);
}
