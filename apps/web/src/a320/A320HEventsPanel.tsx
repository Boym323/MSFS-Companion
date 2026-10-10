import {useEffect,useState} from 'react';

type ModuleStatus={
 moduleReady:boolean;ready:boolean;armed:boolean;fcuFresh:boolean;local:boolean;
 actions:string[];lastError:string|null;note:string
};
const label:Record<string,string>={
 'a320.fcu.speed.selected':'SPD · Selected (PULL)',
 'a320.fcu.speed.managed':'SPD · Managed (PUSH)',
 'a320.fcu.heading.selected':'HDG · Selected (PULL)',
 'a320.fcu.heading.managed':'HDG · Managed (PUSH)',
 'a320.fcu.altitude.selected':'ALT · Selected (PULL)',
 'a320.fcu.altitude.managed':'ALT · Managed (PUSH)'
};

export default function A320HEventsPanel({live,aircraft}:{
 live:boolean;aircraft:string
}){
 const [status,setStatus]=useState<ModuleStatus|null>(null);
 const [working,setWorking]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
   if(!live||!aircraft){setStatus(null);return;}
   let stopped=false;
   const refresh=async()=>{
     try{
       const r=await fetch('/api/a320/wasm/status',{cache:'no-store'});
       if(!r.ok)throw Error();
       const value=await r.json() as ModuleStatus;
       if(!stopped)setStatus(value);
     }catch{if(!stopped)setStatus(null);}
   };
   void refresh();
   const interval=window.setInterval(()=>void refresh(),3000);
   return()=>{stopped=true;window.clearInterval(interval);};
 },[live,aircraft]);

 async function probe(){
   if(working)return;
   setWorking(true);setMessage('');
   try{
     const response=await fetch('/api/a320/wasm/probe',{
       method:'POST',headers:{'X-MSFS-Companion-Action':'a320-wasm-probe'}
     });
     if(!response.ok)throw Error('Test modulu vyžaduje Windows PC, běžící MSFS a načtený Asobo A320neo.');
     const payload=await response.json() as {moduleReady:boolean;note:string};
     setMessage(payload.note);
   }catch(e){setMessage(e instanceof Error?e.message:'Modul není dostupný.');}
   finally{setWorking(false);}
 }

 async function send(command:string){
   if(!status?.ready||working)return;
   setWorking(true);setMessage('');
   try{
     const token=window.sessionStorage.getItem('msfs-companion-control-session');
     const response=await fetch('/api/a320/wasm/command',{
       method:'POST',
       headers:{'Content-Type':'application/json',
         ...(token?{'X-MSFS-Control-Token':token}:{})},
       body:JSON.stringify({command})
     });
     if(!response.ok){
       const detail=await response.json().catch(()=>null) as {error?:string;detail?:string}|null;
       throw Error(detail?.error??detail?.detail??'H-událost nebyla odeslána.');
     }
     setMessage('Modul H-událost přijal. Reálný režim FCU ověřte vizuálně v MSFS 2020.');
   }catch(e){setMessage(e instanceof Error?e.message:'Chyba H-události.');}
   finally{setWorking(false);}
 }

 const state=status?.ready?'Dostupné pro test':
   status?.moduleReady?'Modul odpovídá, ovládání není aktivováno':
   'Modul není potvrzen';
 return <section className="a320-section a320-native-module">
   <h3>A320 · Managed / Selected</h3>
   <p className="a320-hint">Původní Asobo A320neo V1 používá H-události uvnitř simulátoru.
     Toto je samostatná připravená integrace s vlastním Kokpit WASM modulem;
     displeje ani AP1/AP2 se v této etapě neovládají.</p>
   <p className="a320-hint"><strong>Stav H-Event modulu:</strong> {state}.
     {' '}Lokální aktivace referenčního FCU ovládání a čerstvá identita
     letadla jsou povinné i pro tyto příkazy.</p>
   {status?.local && <button type="button" className="a320-fcu-arm"
     disabled={working||!live} onClick={()=>void probe()}>
     Ověřit připojení WASM modulu
   </button>}
   <div className="a320-h-event-grid">
     {Object.entries(label).map(([command,title])=>
       <button type="button" key={command}
         disabled={!status?.ready||working}
         onClick={()=>void send(command)}>{title}</button>)}
   </div>
   {message&&<p role="status" className="a320-alert">{message}</p>}
   {status?.lastError&&<p className="a320-hint">Poslední chyba modulu:
      {' '}{status.lastError}</p>}
   <p className="a320-hint">Potvrzení WASM znamená přijetí příkazu v modulu,
     <strong> ne potvrzení skutečného Airbus FCU/FMA</strong>.
     Bez nahraného a ověřeného modulu jsou všechny ovladače zakázané.</p>
 </section>;
}
