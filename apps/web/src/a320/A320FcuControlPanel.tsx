import {useEffect, useState} from 'react';

type Evidence = { state: 'none'|'pending'|'simvar_observed'|'unconfirmed';
  command?: string|null; value?: number|null; sentAtUtc?: string|null };
type Status = {
  armed:boolean; canArm:boolean; local:boolean; ready:boolean;
  readbackFresh:boolean; aircraft:string|null; evidence:Evidence;
  note:string;
};
type Action = {command:string; title:string; unit:string;
  min:number; max:number; step:number; initial:string };
const actions:Action[]=[
  {command:'a320.fcu.speed.set',title:'Rychlost',unit:'kt',min:100,max:350,step:1,initial:'250'},
  {command:'a320.fcu.mach.set',title:'Mach',unit:'M',min:.1,max:.95,step:.01,initial:'0.78'},
  {command:'a320.fcu.heading.set',title:'Kurz',unit:'°',min:0,max:359,step:1,initial:'270'},
  {command:'a320.fcu.altitude.set',title:'Výška',unit:'ft',min:100,max:49000,step:100,initial:'10000'},
  {command:'a320.fcu.vs.set',title:'Vertikální rychlost',unit:'ft/min',min:-6000,max:6000,step:100,initial:'0'}
];

export default function A320FcuControlPanel({live,aircraft}:{
  live:boolean;aircraft:string
}){
  const [status,setStatus]=useState<Status|null>(null);
  const [values,setValues]=useState<Record<string,string>>(()=>
    Object.fromEntries(actions.map(a=>[a.command,a.initial])));
  const [acknowledged,setAcknowledged]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    if(!live || !aircraft){setStatus(null);return;}
    let cancelled=false;
    const refresh=async()=>{
      try{
        const result=await fetch('/api/a320/controls/status',{cache:'no-store'});
        if(!result.ok)throw Error();
        const next=await result.json() as Status;
        if(!cancelled)setStatus(next.aircraft===aircraft?next:null);
      }catch{if(!cancelled)setStatus(null);}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),2100);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[live,aircraft]);

  const arm=async(enabled:boolean)=>{
    setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/a320/controls/arm',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-MSFS-Companion-Action':'a320-fcu-arm'},
        body:JSON.stringify({enabled})
      });
      if(!r.ok)throw Error(r.status===403
        ? 'Aktivaci proveďte v prohlížeči na Windows PC (localhost).'
        : 'Nelze aktivovat: zkontrolujte identitu letadla a aktuální FCU data.');
      setAcknowledged(false);
      setStatus(null);
      setMessage(enabled?'Testovací ovládání aktivováno na 30 minut pro aktuální letadlo.':
        'Testovací ovládání bylo deaktivováno.');
    }catch(e){setMessage(e instanceof Error?e.message:'Chyba aktivace');}
    finally{setBusy(false);}
  };
  const command=async(action:Action)=>{
    const raw=values[action.command]?.trim()??'';
    const n=Number(raw);
    if(!raw||!Number.isFinite(n)||n<action.min||n>action.max||
       Math.abs(n/action.step-Math.round(n/action.step))>0.000001){
      setMessage('Zadejte hodnotu v povoleném rozsahu a kroku.');return;
    }
    setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/a320/controls/command',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({command:action.command,value:n})
      });
      if(!r.ok){
        const err=await r.json().catch(()=>null) as {error?:string}|null;
        throw Error(err?.error??'Příkaz byl odmítnut (HTTP '+r.status+').');
      }
      setMessage(action.title+': odeslána referenční hodnota '+raw+
        '. Následná změna SimVar bude uvedena níže, skutečný FCU ověřte v MSFS.');
    }catch(e){setMessage(e instanceof Error?e.message:'Chyba FCU příkazu');}
    finally{setBusy(false);}
  };

  const evidence=status?.evidence;
  return <section className="a320-section a320-control-panel">
    <h3>A320 · referenční FCU ovládání</h3>
    <p className="a320-hint">
      Experimentální Key Events původního MSFS 2020. Mění požadované reference,
      nikoli potvrzené Airbus managed/selected režimy. Žádné AP1/AP2,
      A/THR, FMA ani MCDU příkazy se neposílají.
    </p>
    <div className="a320-fcu-control-status" role="status">
      <strong>{status?.ready?'FCU reference – povoleno':
        status?.armed?'Povoleno, čekám na čerstvá data':
        'FCU příkazy jsou uzamčené'}</strong>
      <span>{status?.local?'Windows PC · místní řízení':'iPad / notebook · vzdálený panel'}</span>
    </div>
    {status?.local && !status.armed && <>
      <label className="a320-fcu-ack">
        <input type="checkbox" checked={acknowledged}
          onChange={e=>setAcknowledged(e.target.checked)}/>
        Rozumím, že účinek Key Events na původním Asobo A320neo V1
        ještě nebyl ověřen za letu; budu používat jen na zemi při testování.
      </label>
      <button className="a320-fcu-arm" disabled={!acknowledged||!status.canArm||busy}
        onClick={()=>void arm(true)} type="button">
        Povolit testovací FCU reference na 30 minut
      </button>
    </>}
    {status?.local && status.armed && <button className="a320-fcu-arm"
      type="button" disabled={busy} onClick={()=>void arm(false)}>
      Deaktivovat FCU ovládání
    </button>}
    {!status?.local && !status?.armed && <p className="a320-hint">
      Nejprve aktivujte ovládání na počítači s MSFS otevřením
      <code> http://127.0.0.1:8765/a320</code>. Poté jej lze používat
      z důvěryhodné LAN po dobu této autorizace.
    </p>}
    <div className="a320-fcu-action-grid">
      {actions.map(a=><div key={a.command} className="a320-fcu-action">
        <label htmlFor={a.command}>{a.title} <span>{a.unit}</span></label>
        <div className="a320-fcu-action-row">
          <input id={a.command} type="number" inputMode="decimal"
            min={a.min} max={a.max} step={a.step}
            value={values[a.command]??''}
            onChange={e=>setValues(p=>({...p,[a.command]:e.target.value}))}/>
          <button type="button" disabled={!status?.ready||busy}
            onClick={()=>void command(a)}>Odeslat</button>
        </div>
      </div>)}
    </div>
    <p className="a320-hint">
      <strong>Ověření posledního povelu:</strong>{' '}
      {evidence?.state==='pending'?'Čekám na novější čtení SimVar':
        evidence?.state==='simvar_observed'?'Požadovaná reference pozorována v SimVar (FCU/FMA nepotvrzeno)':
        evidence?.state==='unconfirmed'?'Bez potvrzené změny SimVar – příkaz nepokládejte za provedený':
        'Zatím žádný odeslaný příkaz'}
    </p>
    {message&&<p className="a320-alert" role="status">{message}</p>}
    <p className="a320-hint">Při změně letadla, přerušení SimConnectu nebo vypršení
      30 minut se autorizace automaticky ruší. Generické příkazy autopilota
      zůstávají pro všechny Airbusy zablokované.</p>
  </section>;
}
