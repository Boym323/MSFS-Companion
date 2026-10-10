import {useEffect,useState} from 'react';
import {
 fcuDataFresh,fcuSpecs,formatFcuValue,nextFcuReference,orderedFcuFields,
 validateFcuReference,type FcuField,type FcuReference
} from './fcuUiModel';
import './A320FcuCockpit.css';

type ControlsStatus={
 armed:boolean;canArm:boolean;local:boolean;ready:boolean;readbackFresh:boolean;
 aircraft:string|null;evidence:{state:'none'|'pending'|'simvar_observed'|'unconfirmed';command?:string|null};
 note:string
};
type WasmStatus={
 moduleReady:boolean;ready:boolean;armed:boolean;fcuFresh:boolean;local:boolean;
 lastError:string|null;note:string
};
type ReferenceDrafts=Partial<Record<FcuField,string>>;
const managedFields=['speed','heading','altitude'] as const;
const labelForMode={speed:'SPD',heading:'HDG',altitude:'ALT'} as const;

function KnobIllustration(){
 return <span className="a320-ui-knob" aria-hidden="true">
  <span className="a320-ui-knob-ring"><span className="a320-ui-knob-face">
    <span className="a320-ui-knob-indicator"/></span></span>
 </span>;
}

function CapabilityButton({label,description}:{label:string;description:string}){
 return <button type="button" className="a320-ui-system-button" disabled
  aria-label={label+' – '+description} title={description}>
  <span>{label}</span><small>NEOVĚŘENO</small>
 </button>;
}

export default function A320FcuCockpit({live,aircraft,readbackAircraft,fcu,fcuAgeMs}:{
 live:boolean;aircraft:string;readbackAircraft:string|null;
 fcu:FcuReference|null;fcuAgeMs:number|null
}){
 const [controls,setControls]=useState<ControlsStatus|null>(null);
 const [wasm,setWasm]=useState<WasmStatus|null>(null);
 const [drafts,setDrafts]=useState<ReferenceDrafts>({});
 const [machMode,setMachMode]=useState(false);
 const [accepted,setAccepted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [pollVersion,setPollVersion]=useState(0);
 const fresh=fcuDataFresh(live,aircraft,readbackAircraft,fcuAgeMs,fcu);
 const canSet=fresh&&controls?.ready===true&&controls.aircraft===aircraft&&!busy;
 const canMode=canSet&&wasm?.ready===true;
 const visibleFields: FcuField[]=orderedFcuFields.map(x=>x==='speed'&&machMode?'mach':x);

 useEffect(()=>{
  setControls(null);setWasm(null);setDrafts({});setAccepted(false);
  setMessage('');setMachMode(false);
 },[aircraft,live]);

 useEffect(()=>{
  if(!live||!aircraft){setControls(null);setWasm(null);return;}
  let stopped=false;
  let inFlight=false;
  const update=async()=>{
   if(stopped||inFlight)return;
   inFlight=true;
   try{
    const [controlResponse,wasmResponse]=await Promise.all([
     fetch('/api/a320/controls/status',{cache:'no-store'}),
     fetch('/api/a320/wasm/status',{cache:'no-store'})
    ]);
    if(!controlResponse.ok||!wasmResponse.ok)throw Error('Nelze načíst stav řízení.');
    const [control,wasmData]=await Promise.all([
     controlResponse.json() as Promise<ControlsStatus>,
     wasmResponse.json() as Promise<WasmStatus>
    ]);
    if(!stopped){
     setControls(control.aircraft===aircraft?control:null);
     setWasm(control.aircraft===aircraft?wasmData:null);
    }
   }catch{
    if(!stopped){setControls(null);setWasm(null);}
   }finally{inFlight=false;}
  };
  void update();
  const interval=window.setInterval(()=>void update(),2200);
  return()=>{stopped=true;window.clearInterval(interval);};
 },[live,aircraft,pollVersion]);

 const step=(field:FcuField,delta:-1|1)=>{
  const current=Number(drafts[field]??(fcu?fcuSpecs[field].value(fcu):NaN));
  const next=nextFcuReference(field,current,delta);
  if(next!==null)setDrafts(p=>({...p,[field]:String(next)}));
 };

 const send=async(endpoint:string,body:object,kind:'reference'|'mode')=>{
  if(busy)return;
  setBusy(true);setMessage('');
  try{
   const token=window.sessionStorage.getItem('msfs-companion-control-session');
   const response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json',
     ...(token?{'X-MSFS-Control-Token':token}:{})},
    body:JSON.stringify(body)
   });
   if(!response.ok){
    const reason=await response.json().catch(()=>null) as
      {error?:string;detail?:string}|null;
    throw Error(reason?.error??reason?.detail??('Příkaz odmítnut (HTTP '+response.status+').'));
   }
   setMessage(kind==='reference'
    ?'Referenční povel byl odeslán. Změnu hodnoty sledujte ve FCU; skutečný účinek potvrďte v MSFS.'
    :'WASM modul přijal událost. Režim Airbus FCU/FMA není tímto potvrzen.');
  }catch(error){setMessage(error instanceof Error?error.message:'Odeslání selhalo.');}
  finally{setBusy(false);setPollVersion(v=>v+1);}
 };

 const submit=(field:FcuField)=>{
  if(!canSet)return;
  const raw=drafts[field]??(fcu?String(fcuSpecs[field].value(fcu)):'');
  const value=Number(raw);
  if(!raw.trim()||!validateFcuReference(field,value)){
   setMessage('Hodnota je mimo povolený rozsah nebo krok.');return;
  }
  void send('/api/a320/controls/command',
   {command:fcuSpecs[field].command,value},'reference');
 };

 const sendMode=(field:typeof managedFields[number],mode:'managed'|'selected')=>{
  if(!canMode)return;
  void send('/api/a320/wasm/command',
   {command:'a320.fcu.'+field+'.'+mode},'mode');
 };

 const arm=async(enabled:boolean)=>{
  if(busy||!controls?.local||enabled&&(!accepted||!controls.canArm))return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/a320/controls/arm',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-MSFS-Companion-Action':'a320-fcu-arm'},
    body:JSON.stringify({enabled})
   });
   if(!response.ok)throw Error(response.status===403
     ?'Ovládání se povoluje pouze na Windows PC přes localhost.'
     :'Aktivace nebyla povolena. Zkontrolujte identitu a aktuální FCU data.');
   setAccepted(false);
   setControls(null);setWasm(null);
   setMessage(enabled?'Ovládání povoleno pro aktuální letadlo na 30 minut.':
    'Ovládání deaktivováno.');
  }catch(error){setMessage(error instanceof Error?error.message:'Aktivace selhala.');}
  finally{setBusy(false);setPollVersion(v=>v+1);}
 };

 const probe=async()=>{
  if(busy||!controls?.local)return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/a320/wasm/probe',{
    method:'POST',headers:{'X-MSFS-Companion-Action':'a320-wasm-probe'}
   });
   if(!response.ok)throw Error('Kontrola modulu vyžaduje běžící MSFS na Windows PC.');
   const result=await response.json() as {note:string;moduleReady:boolean};
   setMessage(result.note);
  }catch(error){setMessage(error instanceof Error?error.message:'WASM modul nereaguje.');}
  finally{setBusy(false);setPollVersion(v=>v+1);}
 };

 return <section className="a320-ui-shell" aria-label="Dotykový panel Airbus FCU">
  <div className="a320-ui-topline">
   <div>
    <span className="a320-ui-overline">KOKPIT / AIRBUS A320neo V1</span>
    <h3>Flight Control Unit <span>FCU</span></h3>
   </div>
   <div className="a320-ui-flags" aria-live="polite">
    <span className={live?'is-on':''}>MSFS {live?'ONLINE':'OFFLINE'}</span>
    <span className={fresh?'is-on':''}>FCU {fresh?'ŽIVÁ DATA':'NEDOSTUPNÉ'}</span>
    <span className={wasm?.moduleReady?'is-on':''}>WASM {wasm?.moduleReady?'OK':'NEOVĚŘENO'}</span>
    <span className={canSet?'is-on':''}>OVLÁDÁNÍ {canSet?'AKTIVNÍ':'ZAMČENO'}</span>
   </div>
  </div>

  <div className="a320-ui-main">
   <div className="a320-ui-fcu-channels">
    {visibleFields.map(field=>{
     const spec=fcuSpecs[field];
     const liveValue=fresh&&fcu?spec.value(fcu):null;
     const draft=drafts[field];
     const changed=draft!==undefined&&Number(draft)!==liveValue;
     const editable=fresh&&!!controls?.ready&&!busy;
     return <div className="a320-ui-channel" key={field}>
      <div className="a320-ui-channel-top">
       <span>{spec.label}</span>
       {field==='speed'||field==='mach'
        ?<button className="a320-ui-unit-toggle" type="button"
          onClick={()=>setMachMode(x=>!x)} title="Přepnout zobrazení referenční rychlosti KT/MACH (nepřepíná režim simulátoru)">
          {machMode?'MACH / SPD':'SPD / MACH'}</button>
        :<small>{spec.unit}</small>}
      </div>
      <div className="a320-ui-display" aria-live="off">
       <strong>{formatFcuValue(field,liveValue)}</strong>
       <span>{spec.unit}</span>
      </div>
      <p className="a320-ui-readback-caption">{fresh?'OBECNÁ SIMVAR':'BEZ ČERSTVÉHO ČTENÍ'}</p>
      <div className="a320-ui-rotary">
       <button type="button" className="a320-ui-step"
        disabled={!editable||nextFcuReference(field,Number(draft??liveValue),-1)===null}
        onClick={()=>step(field,-1)}
        aria-label={spec.label+' snížit referenci'}>−</button>
       <KnobIllustration/>
       <button type="button" className="a320-ui-step"
        disabled={!editable||nextFcuReference(field,Number(draft??liveValue),1)===null}
        onClick={()=>step(field,1)}
        aria-label={spec.label+' zvýšit referenci'}>+</button>
      </div>
      <div className="a320-ui-set-row">
       <input type="number" inputMode="decimal"
        aria-label={spec.label+' požadovaná reference'}
        min={spec.min} max={spec.max} step={spec.step}
        disabled={!editable} value={draft??(liveValue===null?'':String(liveValue))}
        onChange={e=>setDrafts(p=>({...p,[field]:e.target.value}))}/>
       <button type="button" disabled={!canSet||!changed||
          !validateFcuReference(field,Number(draft))}
        onClick={()=>submit(field)} aria-label={'Odeslat '+spec.label+' referenci'}>
        NASTAVIT
       </button>
      </div>
      {managedFields.includes(field as typeof managedFields[number])&&field!=='mach'?
       <div className="a320-ui-pushpull">
        <button type="button" disabled={!canMode}
         onClick={()=>sendMode(field as typeof managedFields[number],'managed')}
         aria-label={labelForMode[field as typeof managedFields[number]]+' PUSH – požádat Managed'}>
         <strong>PUSH</strong><span>MANAGED</span>
        </button>
        <button type="button" disabled={!canMode}
         onClick={()=>sendMode(field as typeof managedFields[number],'selected')}
         aria-label={labelForMode[field as typeof managedFields[number]]+' PULL – požádat Selected'}>
         <strong>PULL</strong><span>SELECTED</span>
        </button>
       </div>:
       <p className="a320-ui-no-mode">{field==='mach'?
        'PUSH/PULL rychlosti je dostupné v režimu SPD.':
        'PUSH/PULL V/S zatím nemá ověřený H-Event.'}</p>}
     </div>;
    })}
   </div>
   <div className="a320-ui-autopilot">
    <div className="a320-ui-ap-master">
     <span>AP MASTER · OBECNÁ SIMVAR</span>
     <strong>{fresh&&fcu?(fcu.autopilotMaster?'ON':'OFF'):'---'}</strong>
    </div>
    <div className="a320-ui-ap-buttons">
     {['AP1','AP2','A/THR','LOC','APPR','EXPED','METRIC ALT'].map(label=>
      <CapabilityButton key={label} label={label}
       description="Ovládání vyžaduje ověřený příkaz a zpětnou vazbu z původního Asobo A320neo V1"/>)}
    </div>
    <p className="a320-ui-limitation">AP1/AP2, A/THR a ostatní přepínače jsou zatím jen orientační.
     Neodesílají žádný neověřený povel.</p>
   </div>
  </div>

  <div className="a320-ui-access">
   <div>
    <strong>{!live?'Čekám na MSFS 2020':
     !fresh?'Čekám na čerstvé hodnoty FCU':
     canSet?'Testovací řízení povoleno':'Ovládání je uzamčeno'}</strong>
    <p>{controls?.local?'Přístup na Windows localhost':'Přístup z iPadu / domácí sítě'}.
     {' '}Reference jsou čtené ze SimConnectu, ne z Airbus FMA. Povel WASM ještě
     neprokazuje změnu režimu ve skutečném FCU.</p>
   </div>
   <div className="a320-ui-access-actions">
    {controls?.local&&<button type="button" onClick={()=>void probe()}
      disabled={!live||busy} className="a320-ui-access-button">Ověřit WASM</button>}
    {controls?.local&&controls.armed&&<button type="button"
      onClick={()=>void arm(false)} disabled={busy}
      className="a320-ui-access-button">Zamknout ovládání</button>}
   </div>
  </div>
  {controls?.local&&!controls.armed&&
   <div className="a320-ui-consent">
    <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
     Rozumím, že účinek příkazů na FCU není ověřen. Budu je zkoušet na zemi.</label>
    <button type="button" disabled={!accepted||!controls.canArm||busy}
     onClick={()=>void arm(true)}>Povolit ovládání na 30 minut</button>
   </div>}
  {!controls?.local&&!controls?.armed&&
   <p className="a320-ui-remote">Povolení ovládání a bezpečný ping WASM modulu proveď
    nejprve na PC s MSFS přes <code>http://127.0.0.1:8765/a320</code>.</p>}
  {controls?.evidence?.state!=='none'&&controls?.evidence&&
   <p className="a320-ui-evidence" role="status">Referenční povel:
    {' '}{controls.evidence.state==='pending'?'čekám na novější SimVar':controls.evidence.state==='simvar_observed'
     ?'změna SimVar pozorována (FCU nepotvrzeno)':'bez potvrzené změny SimVar'}</p>}
  {message&&<p className="a320-ui-message" role="status">{message}</p>}
 </section>;
}
