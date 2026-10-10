import {useState} from 'react';
import {fcuSpecs,formatFcuValue,nextFcuReference,validateFcuReference,
 type FcuField,type FcuReference} from './fcuUiModel';
import './A320FcuHardware.css';

/** A hardware-proportioned representation of the original A320neo V1 FCU.
 * General SimVars are references, not aircraft-verified FCU annunciations.
 * Unmapped pushbuttons and rotary switch positions must never send commands.
 */
type Props={
 fcu:FcuReference|null;fresh:boolean;busy:boolean;canSet:boolean;canMode:boolean;
 machMode:boolean;drafts:Partial<Record<FcuField,string>>;
 onMachMode:()=>void;onStep:(field:FcuField,steps:number)=>void;
 onDraft:(field:FcuField,value:string)=>void;onSubmit:(field:FcuField)=>void;
 onMode:(field:'speed'|'heading'|'altitude',mode:'managed'|'selected')=>void;
};

const segments:Record<string,string>={
 '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc',
 '5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abfgcd',
 '-':'g','+':'plus','.':'dot',' ':''
};
const segmentBoxes:Record<string,{x:number;y:number;w:number;h:number}>={
 a:{x:5,y:2,w:16,h:3},b:{x:21,y:5,w:3,h:14},c:{x:21,y:23,w:3,h:14},
 d:{x:5,y:39,w:16,h:3},e:{x:2,y:23,w:3,h:14},f:{x:2,y:5,w:3,h:14},
 g:{x:5,y:20,w:16,h:3}
};

function LedNumber({value,label,characters}:{value:string;label:string;characters:number}){
 const chars=value.length>characters?value.slice(-characters):value.padStart(characters,' ');
 return <svg className="a320-hw-digits" viewBox={'0 0 '+(chars.length*27)+' 45'}
   role="img" aria-label={label+': '+value} preserveAspectRatio="xMidYMid meet">
   {chars.split('').map((char,index)=>{
    const lit=segments[char]??'';
    return <g key={index} transform={'translate('+(index*27)+' 0)'}>
     {'abcdefg'.split('').map(seg=>{
      const box=segmentBoxes[seg];
      return <rect key={seg} x={box.x} y={box.y} width={box.w}
       height={box.h} rx="0.7"
       className={lit.includes(seg)?'a320-hw-segment-on':'a320-hw-segment-off'}/>;
     })}
     {lit==='plus'&&<g className="a320-hw-segment-on">
       <rect x="11" y="10" width="3" height="24" rx=".6"/>
       <rect x="2" y="20" width="21" height="3" rx=".6"/>
     </g>}
     {lit==='dot'&&<circle cx="21" cy="39" r="2.8" className="a320-hw-segment-on"/>}
    </g>;
   })}
 </svg>;
}

function Window({id,label,extra,value}:{id:string;label:string;extra?:string;value:string}){
 return <div className={'a320-hw-window a320-hw-window-'+id}>
   <div className="a320-hw-window-legend">
    <span>{label}</span>{extra&&<span>{extra}</span>}
   </div>
   <div className="a320-hw-led-frame">
    <LedNumber value={value} label={label} characters={id==='altitude'?5:id==='vs'?5:id==='speed'&&value.includes('.')?4:3}/>
   </div>
 </div>;
}

function Selector({label,subLabel,onClick,active=false}:{
 label:string;subLabel?:string;onClick?:()=>void;active?:boolean
}){
 return <button type="button" className={'a320-hw-selector'+(active?' is-positioned':'')}
  onClick={onClick} disabled={!onClick}
  title={onClick?label+' — přepíná pouze zobrazení na webu':
   label+' — skutečná poloha v letadle zatím není k dispozici'}
  aria-label={label+(subLabel?' '+subLabel:'')+(onClick?' (lokální nastavení)':' (nedostupné)')}>
   <span className="a320-hw-selector-lip"/><span className="a320-hw-selector-center"/>
 </button>;
}

function PushButton({children,small=false}:{children:string;small?:boolean}){
 return <button type="button" disabled className={'a320-hw-pb'+(small?' a320-hw-pb-small':'')}
  title={children+' – ovládání zatím nemá ověřené mapování pro Asobo A320neo V1'}
  aria-label={children+' — neověřený ovladač, vypnuto'}>
   <span className="a320-hw-pb-lens"/><span className="a320-hw-pb-legend">{children}</span>
 </button>;
}

function Knob({label,onMinus,onPlus,disabled,altitude=false,vertical=false}:{
 label:string;onMinus:()=>void;onPlus:()=>void;disabled:boolean;
 altitude?:boolean;vertical?:boolean
}){
 return <div className={'a320-hw-knob-group'+(altitude?' is-alt':'')+(vertical?' is-vs':'')}>
  {altitude&&<div className="a320-hw-knob-markings"><span>100</span><span>1000</span></div>}
  {vertical&&<div className="a320-hw-vs-arrows" aria-hidden="true">
   <span className="a320-hw-vs-up">↶ UP</span><span className="a320-hw-vs-down">DN ↷</span>
  </div>}
  <div className="a320-hw-knob-control">
   <button className="a320-hw-tiny-step" type="button" disabled={disabled}
    onClick={onMinus} aria-label={label+' snížit požadovanou hodnotu'}>−</button>
   <button type="button" className="a320-hw-knob" disabled={disabled}
    title={label+' – dotykem zvýšit požadovanou hodnotu; − / + upravuje pouze návrh hodnoty'}
    onClick={onPlus}
    onWheel={e=>{if(!disabled){e.preventDefault();(e.deltaY>0?onMinus:onPlus)();}}}
    aria-label={label+' – otočný ovladač, klepnutím zvýšit návrh hodnoty'}>
    <span className="a320-hw-knob-bezel"><span className="a320-hw-knob-grip">
     <span className="a320-hw-knob-top"><span className="a320-hw-knob-pointer"/></span>
    </span></span>
   </button>
   <button className="a320-hw-tiny-step" type="button" disabled={disabled}
    onClick={onPlus} aria-label={label+' zvýšit požadovanou hodnotu'}>+</button>
  </div>
 </div>;
}

function ChannelEditor({field,liveValue,draft,canSet,busy,onDraft,onSubmit}:{
 field:FcuField;liveValue:number|null;draft:string|undefined;canSet:boolean;busy:boolean;
 onDraft:(field:FcuField,value:string)=>void;onSubmit:(field:FcuField)=>void
}){
 const spec=fcuSpecs[field];
 const shown=draft??(liveValue===null?'':String(liveValue));
 const changed=liveValue!==null&&draft!==undefined&&Number(draft)!==liveValue;
 return <div className="a320-hw-editor-field">
  <label htmlFor={'a320-hw-input-'+field}>{spec.label} <small>{spec.unit}</small></label>
  <div className="a320-hw-editor-row">
   <input id={'a320-hw-input-'+field} type="number" inputMode="decimal"
    min={spec.min} max={spec.max} step={spec.step} disabled={!canSet}
    value={shown} onChange={e=>onDraft(field,e.target.value)}/>
   <button type="button" disabled={!canSet||busy||!changed||
      !draft?.trim()||!validateFcuReference(field,Number(draft))}
    onClick={()=>onSubmit(field)}>NASTAVIT</button>
  </div>
 </div>;
}

export default function A320FcuHardware({
 fcu,fresh,busy,canSet,canMode,machMode,drafts,onMachMode,
 onStep,onDraft,onSubmit,onMode
}:Props){
 const [altThousand,setAltThousand]=useState(false);
 const speedField:FcuField=machMode?'mach':'speed';
 const fieldValues:Record<FcuField,number|null>={
  speed:fresh&&fcu?fcu.selectedSpeedKnots:null,
  mach:fresh&&fcu?fcu.selectedMach:null,
  heading:fresh&&fcu?fcu.selectedHeadingDegrees:null,
  altitude:fresh&&fcu?fcu.selectedAltitudeFeet:null,
  vs:fresh&&fcu?fcu.selectedVerticalSpeedFpm:null
 };
 const led=(field:FcuField)=>{
  const value=fieldValues[field];
  if(value===null)return field==='altitude'?'-----':field==='vs'?'-----':'---';
  if(field==='altitude')return String(Math.round(value)).padStart(5,'0');
  if(field==='heading')return String(Math.round(value)).padStart(3,'0');
  if(field==='vs'){
   const text=String(Math.abs(Math.round(value))).padStart(4,'0');
   return (value<0?'-':'+')+text;
  }
  return formatFcuValue(field,value);
 };
 const inc=(field:FcuField,steps:number)=>{
  if(!canSet)return;
  onStep(field,steps);
 };
 const canNudge=(field:FcuField,dir:-1|1,stepCount=1)=>{
  if(!canSet)return false;
  let current=Number(drafts[field]??fieldValues[field]);
  if(fieldValues[field]===null)return false;
  for(let i=0;i<stepCount;i++){
   const next=nextFcuReference(field,current,dir);
   if(next===null)return false;
   current=next;
  }
  return true;
 };
 const knob=(field:FcuField,label:string,altitude=false,vertical=false)=>{
  const steps=altitude&&altThousand?10:1;
  return <Knob label={label} altitude={altitude} vertical={vertical}
   disabled={!canSet}
   onMinus={()=>{if(canNudge(field,-1,steps))inc(field,-steps);}}
   onPlus={()=>{if(canNudge(field,1,steps))inc(field,steps);}}/>;
 };
 return <div className="a320-hw-root">
  <p className="a320-hw-notice">VĚRNÉ ROZLOŽENÍ FCU · PŮVODNÍ A320neo V1
   <span>Hodnoty jsou obecné SimVars, nikoli ověřené indikace FCU nebo FMA.</span></p>
  <div className="a320-hw-scroll" role="region" tabIndex={0}
   aria-label="Panel Flight Control Unit; na úzkém displeji lze posouvat vodorovně">
   <div className="a320-hw-faceplate" data-testid="a320-fcu-faceplate">
    <span className="a320-hw-fastener pos-tl"/><span className="a320-hw-fastener pos-tr"/>
    <span className="a320-hw-fastener pos-bl"/><span className="a320-hw-fastener pos-br"/>
    <div className="a320-hw-windows" data-testid="a320-fcu-windows">
     <Window id="speed" label={machMode?'MACH':'SPD'} extra={machMode?'SPD':'MACH'}
      value={led(speedField)}/>
     <Window id="heading" label="HDG" extra="TRK · LAT" value={led('heading')}/>
     <Window id="altitude" label="ALT" extra="LVL / CH" value={led('altitude')}/>
     <Window id="vs" label="V/S" extra="FPA" value={led('vs')}/>
    </div>
    <div className="a320-hw-body">
     <div className="a320-hw-bay a320-hw-bay-speed">
      <div className="a320-hw-switch-stack">
       <span className="a320-hw-engrave">SPD<br/>MACH</span>
       <Selector label="SPD / MACH" onClick={onMachMode}/>
      </div>
      {knob(speedField,'SPD / MACH')}
      <span className="a320-hw-etched-lower">SPD / MACH</span>
     </div>
     <div className="a320-hw-bay a320-hw-bay-heading">
      {knob('heading','HDG / TRK')}
      <span className="a320-hw-etched-lower">HDG / TRK</span>
      <div className="a320-hw-loc"><PushButton children="LOC" small/></div>
     </div>
     <div className="a320-hw-bay a320-hw-bay-center">
      <div className="a320-hw-mode-switches">
       <div><span className="a320-hw-engrave">HDG<br/>TRK</span><Selector label="HDG / TRK"/></div>
       <div><span className="a320-hw-engrave">V/S<br/>FPA</span><Selector label="V/S / FPA"/></div>
      </div>
      <div className="a320-hw-ap-pair">
       <PushButton children="AP1"/><PushButton children="AP2"/>
      </div>
      <div className="a320-hw-athr"><PushButton children="A/THR"/></div>
     </div>
     <div className="a320-hw-bay a320-hw-bay-altitude">
      <div className="a320-hw-alt-main">
       {knob('altitude','ALT',true)}
       <div className="a320-hw-alt-options">
        <Selector label="METRIC ALT"/>
        <span className="a320-hw-engrave">METRIC<br/>ALT</span>
       </div>
      </div>
      <div className="a320-hw-alt-foot">
       <button type="button" className="a320-hw-alt-step-select"
        onClick={()=>setAltThousand(x=>!x)}
        title="Mění jen velikost kroku při editaci webové reference, nikoli otočný přepínač v simulátoru"
        aria-label={'Krok změny výšky: '+(altThousand?'1000':'100')+' stop; pouze web'}>
        {altThousand?'1000':'100'} FT <span>WEB KROK</span>
       </button>
       <PushButton children="EXPED" small/>
      </div>
     </div>
     <div className="a320-hw-bay a320-hw-bay-vs">
      {knob('vs','V/S / FPA',false,true)}
      <span className="a320-hw-level-off">PUSH TO<br/>LEVEL OFF</span>
      <div className="a320-hw-appr"><PushButton children="APPR" small/></div>
     </div>
    </div>
   </div>
  </div>
  <div className="a320-hw-support" role="note">
   <span>SCROLL ⇆ <strong>pokud panel přesahuje šířku obrazovky</strong></span>
   <span>Knoby mění pouze návrh hodnoty. Povel odešle až „Nastavit“.</span>
  </div>
  <div className="a320-hw-dock">
   <div className="a320-hw-dock-heading">
    <div><strong>Ovládání z webu</strong><span>Referenční povely a Airbus PUSH/PULL</span></div>
    <span className={canSet?'a320-hw-dock-ok':'a320-hw-dock-locked'}>
     {canSet?'POVOLENO':'ZAMČENO'}
    </span>
   </div>
   <div className="a320-hw-editor-grid">
    <ChannelEditor key={speedField} field={speedField} liveValue={fieldValues[speedField]}
     draft={drafts[speedField]} canSet={canSet} busy={busy} onDraft={onDraft}
     onSubmit={onSubmit}/>
    <ChannelEditor field="heading" liveValue={fieldValues.heading} draft={drafts.heading}
     canSet={canSet} busy={busy} onDraft={onDraft} onSubmit={onSubmit}/>
    <ChannelEditor field="altitude" liveValue={fieldValues.altitude} draft={drafts.altitude}
     canSet={canSet} busy={busy} onDraft={onDraft} onSubmit={onSubmit}/>
    <ChannelEditor field="vs" liveValue={fieldValues.vs} draft={drafts.vs}
     canSet={canSet} busy={busy} onDraft={onDraft} onSubmit={onSubmit}/>
   </div>
   <div className="a320-hw-managed">
    {(['speed','heading','altitude'] as const).map(field=><div key={field} className="a320-hw-managed-group">
     <span>{field==='speed'?'SPD':field==='heading'?'HDG':'ALT'}</span>
     <button type="button" disabled={!canMode} onClick={()=>onMode(field,'managed')}
      aria-label={field+' PUSH Managed'}>PUSH <small>MANAGED</small></button>
     <button type="button" disabled={!canMode} onClick={()=>onMode(field,'selected')}
      aria-label={field+' PULL Selected'}>PULL <small>SELECTED</small></button>
    </div>)}
   </div>
   <p className="a320-hw-dock-disclaimer">
    Autentická poloha a zelené indikace AP1/AP2/A/THR nejsou dostupné.
    Černé hardwarové přepínače jsou záměrně neaktivní.
    Potvrzení WASM neprokazuje změnu režimu Airbus FMA.
   </p>
  </div>
 </div>;
}
