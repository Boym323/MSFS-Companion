import {useState} from 'react';
import type {TelemetrySnapshot} from '../telemetry/types';
import {aircraftChecklistProfile,checklistSteps,normalizeChecklist,phases,
  type Phase,type ChecklistState} from './checklist';
import './AircraftChecklists.css';

const prefix='msfs-companion-checklist-v1:';
function read(key:string):ChecklistState{
  try{return normalizeChecklist(JSON.parse(window.localStorage.getItem(key)||'null'));}
  catch{return {checked:[],custom:[]};}
}
export default function AircraftChecklists({telemetry}:{telemetry:TelemetrySnapshot|null}){
  const profile=aircraftChecklistProfile(telemetry?.aircraft??null);
  const [phase,setPhase]=useState<Phase>('beforeStart');
  const [draft,setDraft]=useState('');
  const [cache,setCache]=useState<Record<string,ChecklistState>>({});
  const key=prefix+profile+':'+phase;
  const current=cache[key]??read(key);
  const items=[...checklistSteps(profile,phase),...current.custom];
  const activeChecked=new Set(current.checked.filter(id=>items.some(x=>x.id===id)));
  const save=(next:ChecklistState)=>{
    const normalized=normalizeChecklist(next);
    setCache(old=>({...old,[key]:normalized}));
    try{window.localStorage.setItem(key,JSON.stringify(normalized));}catch{}
  };
  const add=()=>{
    const text=draft.trim();
    if(text.length<1||text.length>100||current.custom.length>=25)return;
    save({...current,custom:[...current.custom,{
      id:'custom-'+Date.now()+'-'+current.custom.length,text,custom:true
    }]});
    setDraft('');
  };
  return <section className="checklists">
    <h2>C29 · Interaktivní checklisty</h2>
    <p>Jde o upravitelnou pomůcku pro simulátor, nikoli oficiální postup
      výrobce letadla. Vždy porovnej s příručkou konkrétního addonu.
      Vše se odškrtává pouze ručně; Companion neposílá automatické příkazy.</p>
    <p>Profil: <strong>{profile==='c172'?'Cessna 172':profile==='tbm930'?'TBM 930':'Obecný'}</strong>
      {' · '}Uloženo jen v tomto prohlížeči.</p>
    <div className="checklists-tabs">
      {phases.map(item=><button type="button" key={item.id}
        aria-current={phase===item.id?'step':undefined}
        onClick={()=>setPhase(item.id)}>{item.name}</button>)}
    </div>
    <p role="status">Dokončeno {activeChecked.size}/{items.length}</p>
    <div className="checklists-steps">
      {items.map(step=><div key={step.id}>
        <label><input type="checkbox" checked={activeChecked.has(step.id)}
          onChange={event=>{
            const checked=new Set(activeChecked);
            if(event.target.checked)checked.add(step.id);else checked.delete(step.id);
            save({...current,checked:[...checked]});
          }}/><span>{step.text}</span></label>
        {step.custom&&<button type="button" onClick={()=>save({
          custom:current.custom.filter(x=>x.id!==step.id),
          checked:current.checked.filter(id=>id!==step.id)
        })}>Odebrat</button>}
      </div>)}
    </div>
    <div className="checklists-edit">
      <label>Vlastní krok
        <input value={draft} maxLength={100}
          onChange={event=>setDraft(event.target.value)} placeholder="Doplnit kontrolu…" />
      </label>
      <button type="button" disabled={!draft.trim()||current.custom.length>=25} onClick={add}>
        Přidat krok
      </button>
      <button type="button" onClick={()=>save({...current,checked:[]})}>Vynulovat odškrtnutí</button>
    </div>
  </section>;
}
