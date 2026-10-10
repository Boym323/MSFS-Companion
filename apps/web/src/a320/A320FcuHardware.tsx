import {useRef,useState} from 'react';
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
  </details>
 </div>;
}

/** The little FCU selectors are push buttons, not rotary knobs.
 * Their simulator state is not available so they must never imply an active mode.
 */
function RoundPush({label,onClick}:{label:string;onClick?:()=>void}){
 return <button type="button" className="a320-hw-round-push" disabled={!onClick}
  onClick={onClick}
  title={onClick?label+' – pouze změna webového zobrazení':
   label+' – ovládání v simulátoru zatím není ověřeno'}
  aria-label={label+(onClick?' (mění pouze web)':' (neaktivní)')}>
   <span className="a320-hw-round-rim"><span className="a320-hw-round-inner"/></span>
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
 const gesture=useRef<{id:number;x:number;y:number}|null>(null);
 return <div className={'a320-hw-knob-group'+(altitude?' is-alt':'')+(vertical?' is-vs':'')}>
  <button type="button" className="a320-hw-knob" disabled={disabled}
   title={label+' – posunutí doprava/zleva mění návrh; na hodnotu v letadle se použije NASTAVIT'}
   aria-label={label+' – otočný ovladač. Tažením doprava přidat, doleva ubrat. Klávesy šipek.'}
   onPointerDown={e=>{
    if(disabled||e.button!==0)return;
    gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY};
    e.currentTarget.setPointerCapture(e.pointerId);
   }}
   onPointerUp={e=>{
    const start=gesture.current;
    gesture.current=null;
    if(!start||start.id!==e.pointerId||disabled)return;
    const dx=e.clientX-start.x;
    if(Math.abs(dx)<12){onPlus();return;}
    const count=Math.min(8,Math.max(1,Math.floor(Math.abs(dx)/18)));
    for(let n=0;n<count;n++){if(dx>0)onPlus();else onMinus();}
   }}
   onPointerCancel={()=>{gesture.current=null;}}
   onClick={e=>{if(e.detail===0&&!disabled)onPlus();}}
   onKeyDown={e=>{
    if(disabled)return;
    if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();onPlus();}
    if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();onMinus();}
   }}
   onWheel={e=>{
    if(disabled)return;
    e.preventDefault();
    if(e.deltaY>0)onMinus();else onPlus();
   }}>
   <span className="a320-hw-knob-bezel"><span className="a320-hw-knob-grip">
    <span className="a320-hw-knob-top"><span className="a320-hw-knob-pointer"/></span>
   </span></span>
  </button>
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
     <Window id="speed" label="SPD" extra="MACH" value={led(speedField)}/>
     <Window id="heading" label="HDG" extra="LAT" value={led('heading')}/>
     <div className="a320-hw-center-lamp" aria-hidden="true">
      <span>HDG&nbsp; V/S</span><span>TRK&nbsp; FPA</span>
     </div>
     <Window id="altitude" label="ALT" extra="LVL/CH" value={led('altitude')}/>
     <Window id="vs" label="V/S" extra="FPA" value={led('vs')}/>
    </div>
    <div className="a320-hw-hardware" data-testid="a320-fcu-hardware">
     <div className="a320-hw-item a320-hw-spd-mode">
      <span className="a320-hw-engrave">SPD<br/>MACH</span>
      <RoundPush label="SPD / MACH" onClick={onMachMode}/>
     </div>
     <div className="a320-hw-item a320-hw-speed-knob">
      {knob(speedField,'SPD / MACH')}
     </div>
     <div className="a320-hw-item a320-hw-heading-knob">
      {knob('heading','HDG / TRK')}
     </div>
     <div className="a320-hw-item a320-hw-loc"><PushButton>LOC</PushButton></div>
     <div className="a320-hw-item a320-hw-central-mode">
      <span className="a320-hw-two-line-label"><span>HDG&nbsp; V/S</span><span>TRK&nbsp; FPA</span></span>
      <RoundPush label="HDG V/S – TRK FPA"/>
     </div>
     <div className="a320-hw-item a320-hw-ap1"><PushButton>AP1</PushButton></div>
     <div className="a320-hw-item a320-hw-ap2"><PushButton>AP2</PushButton></div>
     <div className="a320-hw-item a320-hw-athr"><PushButton>A/THR</PushButton></div>
     <div className="a320-hw-item a320-hw-altitude-knob">
      <div className="a320-hw-knob-markings" aria-hidden="true"><span>100</span><span>1000</span></div>
      {knob('altitude','ALT',true)}
     </div>
     <div className="a320-hw-item a320-hw-metric">
      <RoundPush label="METRIC ALT"/>
      <span className="a320-hw-engrave">METRIC<br/>ALT</span>
     </div>
     <div className="a320-hw-item a320-hw-exped"><PushButton>EXPED</PushButton></div>
     <div className="a320-hw-item a320-hw-vs-knob">
      <span className="a320-hw-vs-up">UP</span><span className="a320-hw-vs-down">DN</span>
      {knob('vs','V/S / FPA',false,true)}
     </div>
     <div className="a320-hw-item a320-hw-level-off">PUSH TO<br/>LEVEL<br/>OFF</div>
     <div className="a320-hw-item a320-hw-appr"><PushButton>APPR</PushButton></div>
    </div>
   </div>
  </div>
  <div className="a320-hw-support" role="note">
   <span>⇆ Na užších displejích lze FCU posouvat do stran.</span>
   <span>Táhni knob doleva/doprava pro návrh hodnoty; pro odeslání otevři webové ovládání.</span>
  </div>
  <details className="a320-hw-service">
   <summary><span>Rozbalit webové ovládání referencí a PUSH/PULL</span>
    <span className="a320-hw-service-meta">Úprava hodnot a diagnostika</span></summary>
  <div className="a320-hw-dock">
   <div className="a320-hw-dock-heading">
    <div><strong>Ovládání z webu</strong><span>Referenční povely a Airbus PUSH/PULL</span></div>
    <span className={canSet?'a320-hw-dock-ok':'a320-hw-dock-locked'}>
     {canSet?'POVOLENO':'ZAMČENO'}
    </span>
   </div>
   <div className="a320-hw-quick-settings">
    <label><input type="checkbox" checked={altThousand}
      onChange={e=>setAltThousand(e.target.checked)}/>
      Krok úpravy ALT 1000 ft (jinak 100 ft; pouze webové zadávání)</label>
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
  </details>
 </div>;
}
