import {useEffect,useState} from 'react';
export type AirRadarAircraft={hex:string;callsign:string|null;latitude:number;longitude:number;
  altitudeFeet:number|null;trackDegrees:number|null;distanceNm:number;
  seenPosSeconds:number;source:string|null};
export type AirRadarState={available:boolean;stale:boolean;updatedAt:string|null;
  error:string|null;source:string;aircraft:AirRadarAircraft[]};
const empty:AirRadarState={available:false,stale:false,updatedAt:null,
  error:null,source:'AirRadar',aircraft:[]};
export function validAirRadarAircraft(value:unknown):AirRadarAircraft[]{
  if(!Array.isArray(value))return [];
  return value.slice(0,80).filter((x):x is AirRadarAircraft=>{
    if(!x||typeof x!=='object')return false;
    const a=x as Partial<AirRadarAircraft>;
    return typeof a.hex==='string'&&/^[0-9A-Fa-f]{6}$/.test(a.hex)&&
      typeof a.latitude==='number'&&Number.isFinite(a.latitude)&&Math.abs(a.latitude)<=85.05&&
      typeof a.longitude==='number'&&Number.isFinite(a.longitude)&&Math.abs(a.longitude)<=180&&
      typeof a.seenPosSeconds==='number'&&a.seenPosSeconds>=0&&a.seenPosSeconds<=30&&
      typeof a.distanceNm==='number'&&Number.isFinite(a.distanceNm)&&a.distanceNm>=0;
  });
}
/** Only requested by an opt-in map layer; never creates additional SimConnect polling. */
export function useAirRadarMapLayer(enabled:boolean,latitude:number|null,longitude:number|null,
  zoom:number):AirRadarState{
  const [data,setData]=useState<AirRadarState>(empty);
  const lat=latitude!=null&&Number.isFinite(latitude)&&Math.abs(latitude)<=85.05
    ?Math.round(latitude*20)/20:null;
  const lon=longitude!=null&&Number.isFinite(longitude)&&Math.abs(longitude)<=180
    ?Math.round(longitude*20)/20:null;
  const radiusKm=Math.max(15,Math.min(200,Math.round(160*2**(11-zoom))));
  useEffect(()=>{
    if(!enabled||lat===null||lon===null){setData(empty);return;}
    const abort=new AbortController();let timer:number|undefined;
    const refresh=async()=>{
      try{
        const query=new URLSearchParams({lat:String(lat),lon:String(lon),radiusKm:String(radiusKm)});
        const response=await fetch('/api/integrations/airradar/nearby?'+query.toString(),
          {cache:'no-store',signal:abort.signal});
        if(!response.ok)throw Error('unavailable');
        const result=await response.json() as AirRadarState;
        if(!abort.signal.aborted)setData({
          available:result.available===true&&!result.stale,
          stale:result.stale===true,updatedAt:result.updatedAt??null,
          error:result.error??null,source:'AirRadar',
          aircraft:result.available&&!result.stale?validAirRadarAircraft(result.aircraft):[]
        });
      }catch{if(!abort.signal.aborted)setData({
        available:false,stale:true,updatedAt:null,
        error:'AirRadar spojení není dostupné.',source:'AirRadar',aircraft:[]});}
      finally{if(!abort.signal.aborted)timer=window.setTimeout(()=>void refresh(),35000);}
    };
    void refresh();return()=>{abort.abort();if(timer!==undefined)clearTimeout(timer);};
  },[enabled,lat,lon,radiusKm]);
  return data;
}
