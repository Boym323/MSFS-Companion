export type Phase='beforeStart'|'taxi'|'takeoff'|'approach'|'shutdown';
export type Step={id:string;text:string;custom?:boolean};
export type ChecklistState={checked:string[];custom:Step[]};
export const phases:{id:Phase;name:string}[]=[
 {id:'beforeStart',name:'Příprava'}, {id:'taxi',name:'Pojíždění'},
 {id:'takeoff',name:'Před vzletem'}, {id:'approach',name:'Přiblížení'},
 {id:'shutdown',name:'Vypnutí'}
];
const common:Record<Phase,string[]>={
 beforeStart:['Zkontrolovat plán letu a počasí','Zkontrolovat palivo a rezervy','Ověřit nastavení avioniky'],
 taxi:['Ověřit funkci brzd','Zkontrolovat trasu pojíždění a okolí','Ověřit frekvenci ATC'],
 takeoff:['Ověřit dráhu a vítr','Zkontrolovat konfiguraci letadla','Potvrdit vzletové parametry'],
 approach:['Ověřit cílové letiště a dráhu','Zkontrolovat palivo','Potvrdit plán přiblížení'],
 shutdown:['Bezpečně dokončit let','Zkontrolovat vypnutí avioniky','Zapsat poznámky k letu']
};
export function aircraftChecklistProfile(title:string|null):'c172'|'tbm930'|'generic'{
  if(title&&/(cessna.?172|skyhawk|c172)/i.test(title))return 'c172';
  if(title&&/(tbm.?930)/i.test(title))return 'tbm930';
  return 'generic';
}
export function checklistSteps(profile:string,phase:Phase):Step[]{
 const base=common[phase].map((text,i)=>({id:phase+'-'+i,text}));
 const extra=profile==='c172'&&phase==='beforeStart'
   ?[{id:'c172-fuel',text:'Ověřit nastavení palivového systému podle příručky C172'}]
   :profile==='tbm930'&&phase==='approach'
   ?[{id:'tbm-config',text:'Ověřit konfiguraci TBM 930 podle příručky letadla'}]:[];
 return [...base,...extra];
}
export function normalizeChecklist(value:unknown):ChecklistState{
 if(!value||typeof value!=='object')return {checked:[],custom:[]};
 const input=value as Partial<ChecklistState>;
 const checked=Array.isArray(input.checked)?input.checked
   .filter((v):v is string=>typeof v==='string'&&v.length<=60).slice(0,80):[];
 const custom:Step[]=Array.isArray(input.custom)?input.custom.filter((x):x is Step=>
   x!==null&&typeof x==='object'&&typeof x.id==='string'&&
   /^custom-[a-zA-Z0-9_-]{1,50}$/.test(x.id)&&typeof x.text==='string'&&
   x.text.trim().length>0&&x.text.length<=100).slice(0,25).map(x=>({...x,custom:true})):[];
 return {checked:[...new Set(checked)],custom};
}
