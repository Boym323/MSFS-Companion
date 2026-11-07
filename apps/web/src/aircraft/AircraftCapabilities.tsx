import {useEffect,useState} from 'react';

type CapabilityStatus={
  connected:boolean; aircraft:string|null; status:string;
  profile:{id:string;label:string;avionics:string;verified:boolean;note:string};
  assessment:{state:string;identityTrusted:boolean;commandsConfirmed:boolean;
    fmsVerified:boolean;inputEventsEnumerated:boolean;reason:string};
};
export default function AircraftCapabilities({live,aircraft}:{
  live:boolean;aircraft:string|null
}){
  const [status,setStatus]=useState<CapabilityStatus|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    if(!live||!aircraft){setStatus(null);return;}
    let closed=false;let pending=false;
    const controller=new AbortController();
    const refresh=async()=>{
      if(closed||pending)return;
      pending=true;
      try{
        const response=await fetch('/api/aircraft/capabilities',{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Diagnostika není dostupná');
        const next=await response.json() as CapabilityStatus;
        if(!closed){setStatus(next.aircraft===aircraft&&next.connected?next:null);setError(false);}
      }catch{
        if(!closed){setStatus(null);setError(true);}
      }finally{pending=false;}
    };
    setStatus(null);void refresh();
    const timer=window.setInterval(()=>void refresh(),3000);
    return()=>{closed=true;controller.abort();window.clearInterval(timer);};
  },[live,aircraft]);
  const assessment=status?.assessment;
  return <section className="airbus-capabilities">
    <h2>Airbus · stav dostupných rozhraní</h2>
    <p>Diagnostika pro FlyByWire A32NX a iniBuilds A320neo V2. Nepřítomnost původní
       služby Garmin neznamená, že Companion získal plnohodnotný přístup k FMS.</p>
    <p role="status">{!live?'MSFS je offline.':error?'Diagnostika není dostupná.'
      :!status?'Čekám na potvrzenou identitu letadla.':
      status.profile.label+' · '+assessment?.state}</p>
    {status&&<>
      <p>SimConnect TITLE: <strong>{status.aircraft}</strong></p>
      <p>{assessment?.reason}</p>
      <dl>
        <div><dt>Čerstvá identita SimConnect</dt><dd>{assessment?.identityTrusted?'Ano':'Ne'}</dd></div>
        <div><dt>FMS a jeho plán ověřeny</dt><dd>Ne</dd></div>
        <div><dt>Ovládací povely přes Companion</dt><dd>Nepodporovány</dd></div>
        <div><dt>Enumerace Input Events</dt><dd>Neprovádí se</dd></div>
      </dl>
      <p>{status.profile.note}</p>
      <p>Skutečnou avioniku vždy potvrďte v MSFS. Pro FlyByWire použijte
        oficiální SimBridge; ten vyžaduje samostatnou instalaci.</p>
    </>}
  </section>;
}
