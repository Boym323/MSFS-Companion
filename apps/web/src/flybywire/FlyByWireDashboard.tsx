import {useEffect, useState} from 'react';
import {simbridgeUrls} from './simbridgeUrl';
import './FlyByWireDashboard.css';

type Status = {
  aircraftMatched: boolean; aircraft: string|null; profileId: string|null;
  simBridgeReachable: boolean; checkedOnWindows: boolean; port: number;
  remoteMcduPath: string; fmsSyncVerified: boolean;
  mcduControlByCompanion: boolean; note: string;
};
export default function FlyByWireDashboard({aircraft,live}:{
  aircraft:string|null; live:boolean
}) {
  const [status,setStatus]=useState<Status|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let stopped=false;
    let pending=false;
    const controller=new AbortController();
    const refresh=async()=>{
      if(stopped||pending)return;
      pending=true;
      try{
        const response=await fetch('/api/integrations/flybywire',
          {cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('SimBridge status API unavailable');
        const data=await response.json() as Status;
        if(!stopped){setStatus(data);setError(false);}
      }catch{
        if(!stopped){setStatus(null);setError(true);}
      }finally{pending=false;}
    };
    setStatus(null);
    void refresh();
    const timer=window.setInterval(()=>void refresh(),10000);
    return()=>{stopped=true;controller.abort();window.clearInterval(timer);};
  },[aircraft,live]);
  const valid=live && status?.aircraftMatched===true && status.aircraft===aircraft;
  const urls=simbridgeUrls(window.location.hostname,status?.port??8380);
  const readiness=error?'Diagnostika SimBridge není dostupná':
    !live?'Čekám na živé připojení MSFS':
    !valid?'A32NX není rozpoznáno; ověřte vybraný model letadla':
    status?.simBridgeReachable?'Web Remote MCDU odpovídá na Windows PC':
    'SimBridge Remote MCDU není dostupné na nastaveném portu';
  return <section className="fbw-dashboard" aria-label="FlyByWire A32NX a SimBridge">
    <article className="fbw-card">
      <div className="fbw-card-heading">
        <div><span className="eyebrow">SIMBRIDGE · OFICIÁLNÍ VZDÁLENÉ MCDU</span>
          <h2>FlyByWire A32NX</h2></div>
        <span className="fbw-status" role="status">{readiness}</span>
      </div>
      <p>Pro ovládání F-PLN, INIT, PERF, LSK a klávesnice používáme
        hotové webové MCDU od FlyByWire. Otevírá se samostatně,
        bez přepisu avioniky a bez příkazů z Companion.</p>
      <div className="fbw-actions">
        <a href={urls.primary} target="_blank" rel="noopener noreferrer">
          Otevřít oficiální Remote MCDU
        </a>
        {urls.alternate&&<a href={urls.alternate} target="_blank" rel="noopener noreferrer">
          Otevřít přes adresu Windows hostitele
        </a>}
      </div>
      <p className="fbw-note">Otevřená stránka běží na SimBridge, nikoli v Companion.
        Adresa <code>simbridge.local</code> vyžaduje mDNS; alternativní
        odkaz funguje pouze tehdy, když Companion i SimBridge běží na stejném Windows PC.
        HTTP dostupnost neprokazuje spojení MCDU s letadlem.</p>
      <dl className="fbw-facts">
        <div><dt>Letadlo v SimConnectu</dt><dd>{valid?aircraft:'Neověřeno'}</dd></div>
        <div><dt>SimBridge HTTP</dt><dd>{!valid?'Netestováno':status?.simBridgeReachable?'Odpovídá':'Nedostupné'}</dd></div>
        <div><dt>Port</dt><dd>{status?.port??8380}</dd></div>
        <div><dt>Synchronizace FMS do Companion</dt><dd>Neimplementována</dd></div>
      </dl>
      <p className="fbw-note">{status?.note??'Spusťte A32NX, SimBridge a ověřte spojení na flyPadu.'}</p>
    </article>
    <article className="fbw-card">
      <h3>Navigace a plánování v Companion</h3>
      <p>Nástroje zůstávají nezávislé. Import SimBrief do Companion
        nemění letový plán uvnitř A32NX; ten načtěte na originálním MCDU nebo flyPadu.</p>
      <nav className="fbw-tools" aria-label="Nástroje pro let A32NX">
        <a href="/flight-plan">SimBrief · OFP</a>
        <a href="/map">Mapa letu</a>
        <a href="/vatsim">VATSIM</a>
        <a href="/pfd">PFD telemetrie</a>
        <a href="/weather">METAR / TAF</a>
        <a href="/briefing">Letištní briefing</a>
      </nav>
    </article>
    <article className="fbw-card">
      <h3>První připojení</h3>
      <ol>
        <li>Nainstalujte A32NX a SimBridge oficiálním FlyByWire Installerem.</li>
        <li>Spusťte SimBridge na Windows PC s MSFS 2020 (standardně port 8380).</li>
        <li>Na A32NX flyPadu ověřte Settings → Sim Options → SimBridge: Auto.</li>
        <li>Otevřete Remote MCDU a zkontrolujte skutečný účinek kláves.</li>
      </ol>
      <p className="fbw-note">Pokud byl port SimBridge změněn, lze na Windows
        hostiteli nastavit proměnnou <code>MSFS_SIMBRIDGE_PORT</code>.
        Přístup z Macu/iPadu vyžaduje důvěryhodnou LAN a případně
        pravidlo Windows firewallu pouze pro tuto síť.</p>
    </article>
  </section>;
}
