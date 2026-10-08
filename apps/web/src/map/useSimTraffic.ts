import {useEffect,useState} from 'react';
export type SimTrafficTarget={objectId:number;latitude:number;longitude:number;
 altitudeFeet:number;headingDegrees:number;groundSpeedKnots:number;onGround:boolean};
export type SimTrafficResponse={available:boolean;stale:boolean;updatedAt:string|null;
 status:string;source:string;targets:SimTrafficTarget[]};
const empty:SimTrafficResponse={available:false,stale:false,updatedAt:null,
 status:'not_requested',source:'MSFS SimConnect',targets:[]};

export function useSimTraffic(enabled:boolean):SimTrafficResponse{
 const [data,setData]=useState<SimTrafficResponse>(empty);
 useEffect(()=>{
   if(!enabled){setData(empty);return;}
   let closed=false;const abort=new AbortController();let timer:number|undefined;
   async function update(){
     try{
       const r=await fetch('/api/traffic/nearby',{signal:abort.signal,cache:'no-store'});
       if(!r.ok)throw Error();
       const result=await r.json() as SimTrafficResponse;
       if(!closed)setData({...result,
         targets:Array.isArray(result.targets)?result.targets.slice(0,100).filter(p=>
           Number.isInteger(p.objectId)&&p.objectId>0&&
           Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=85.05&&
           Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&
           Number.isFinite(p.headingDegrees)&&Number.isFinite(p.altitudeFeet)):[]});
     }catch{if(!closed)setData(old=>({...old,available:false,stale:true,status:'no_connection',targets:[]}));}
     finally{if(!closed)timer=window.setTimeout(()=>void update(),7000);}
   }
   void update();
   return()=>{closed=true;abort.abort();if(timer)clearTimeout(timer);};
 },[enabled]);
 return data;
}
