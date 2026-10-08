import { useEffect, useState } from 'react';

export type Sigmet = {kind:string;description:string;
  boundary:{latitude:number;longitude:number}[];validFrom:string|null;validTo:string|null};
type Response = {available:boolean;stale:boolean;updatedAt:string|null;
  source:string;error:string|null;hazards:Sigmet[]};
const empty:Response={available:false,stale:false,updatedAt:null,source:'NOAA',error:null,hazards:[]};

export default function useSigmet(enabled:boolean,latitude:number|null,longitude:number|null):Response{
  const [state,setState]=useState<Response>(empty);
  const lat=latitude!=null&&Number.isFinite(latitude)?Math.round(latitude*2)/2:null;
  const lon=longitude!=null&&Number.isFinite(longitude)?Math.round(longitude*2)/2:null;
  useEffect(()=>{
    if(!enabled||lat===null||lon===null){setState(empty);return;}
    let stopped=false;
    const controller=new AbortController();
    let timer:number|undefined;
    async function refresh(){
      try{
        const query=new URLSearchParams({lat:String(lat),lon:String(lon),radiusKm:'180'});
        const r=await fetch('/api/weather/hazards?'+query,{cache:'no-store',signal:controller.signal});
        if(!r.ok)throw Error();
        const value=await r.json() as Response;
        if(!stopped)setState({...value,hazards:Array.isArray(value.hazards)?value.hazards.slice(0,40):[]});
      }catch{if(!stopped)setState(previous=>({...previous,stale:true,error:'SIGMET se nyní nenačítá.'}));}
      finally{if(!stopped)timer=window.setTimeout(()=>void refresh(),300000);}
    }
    void refresh();
    return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer);};
  },[enabled,lat,lon]);
  return state;
}
