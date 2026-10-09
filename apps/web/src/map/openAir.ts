import { metersBetween } from './geo.ts';

export type Airspace = {name:string;category:string;lower:string;upper:string;
  points:{latitude:number;longitude:number}[]};
type Point = Airspace['points'][number];
type Draft = Airspace & {unsupported:boolean; center:Point|null;clockwise:boolean};
const MAX_VERTICES=250;
const DEG=Math.PI/180;

// OpenAir uses DMS (50:35:36 N) and decimal minutes (50:35.600N).
function coordinate(value:string):number|null {
  const m=/^(\d{1,3}):(\d{1,2}(?:\.\d+)?)(?::(\d{1,2}(?:\.\d+)?))?\s*([NSEW])$/i.exec(value.trim());
  if(!m)return null;
  const degrees=Number(m[1]),minutes=Number(m[2]),seconds=Number(m[3]??0);
  const axis=m[4].toUpperCase();
  const max=axis==='N'||axis==='S'?85.05:180;
  const coordinate=degrees+minutes/60+seconds/3600;
  if(!Number.isFinite(coordinate)||minutes>=60||seconds>=60||coordinate>max)return null;
  return axis==='S'||axis==='W'?-coordinate:coordinate;
}
function point(value:string):Point|null{
  const m=/^(\d{1,3}:\d{1,2}(?:\.\d+)?(?::\d{1,2}(?:\.\d+)?)?\s*[NS])\s+(\d{1,3}:\d{1,2}(?:\.\d+)?(?::\d{1,2}(?:\.\d+)?)?\s*[EW])$/i.exec(value.trim());
  const latitude=m?coordinate(m[1]):null,longitude=m?coordinate(m[2]):null;
  return latitude===null||longitude===null?null:{latitude,longitude};
}
function radius(value:string):number|null{
  if(!/^(?:\d+(?:\.\d+)?)$/.test(value.trim()))return null;
  const number=Number(value);
  // Limit geometry complexity and skip exceptionally large/unverified arcs.
  return Number.isFinite(number)&&number>=0.05&&number<=200?number:null;
}
function bearing(a:Point,b:Point):number{
  const dLon=(((b.longitude-a.longitude+540)%360)-180)*DEG;
  const x=Math.sin(dLon)*Math.cos(b.latitude*DEG);
  const y=Math.cos(a.latitude*DEG)*Math.sin(b.latitude*DEG)-
    Math.sin(a.latitude*DEG)*Math.cos(b.latitude*DEG)*Math.cos(dLon);
  return (Math.atan2(x,y)/DEG+360)%360;
}
function position(center:Point,nauticalMiles:number,bearingDegrees:number):Point|null {
  const delta=nauticalMiles*1852/6371000;
  const angle=bearingDegrees*DEG;
  const lat=center.latitude*DEG,lon=center.longitude*DEG;
  const latOut=Math.asin(Math.sin(lat)*Math.cos(delta)+
    Math.cos(lat)*Math.sin(delta)*Math.cos(angle));
  const lonOut=lon+Math.atan2(Math.sin(angle)*Math.sin(delta)*Math.cos(lat),
    Math.cos(delta)-Math.sin(lat)*Math.sin(latOut));
  const latitude=latOut/DEG;
  const longitude=((lonOut/DEG+540)%360)-180;
  return Number.isFinite(latitude)&&Math.abs(latitude)<=85.05&&Number.isFinite(longitude)
    ?{latitude,longitude}:null;
}
function arc(center:Point,radiusNm:number,start:number,end:number,clockwise:boolean):Point[]|null{
  if(![start,end].every(v=>Number.isFinite(v)&&v>=0&&v<=360))return null;
  const sweep=clockwise?(end-start+360)%360:(start-end+360)%360;
  if(sweep<0.0001)return null; // Full circle must be defined via DC.
  const steps=Math.ceil(sweep/5);
  const output:Point[]=[];
  for(let i=0;i<=steps;i++){
    const angle=start+(clockwise?1:-1)*sweep*i/steps;
    const calculated=position(center,radiusNm,angle);
    if(!calculated)return null;
    output.push(calculated);
  }
  return output;
}
function circle(center:Point,radiusNm:number):Point[]|null{
  const output:Point[]=[];
  for(let i=0;i<72;i++){
    const calculated=position(center,radiusNm,i*5);
    if(!calculated)return null;
    output.push(calculated);
  }
  return output;
}

export function parseOpenAir(text:string):{regions:Airspace[];skipped:number} {
  if(text.length>2_000_000)throw Error('OpenAir soubor přesahuje 2 MB.');
  const regions:Airspace[]=[];let skipped=0;
  let current:Draft|null=null;
  function append(points:Point[]|null){
    if(!current)return;
    if(!points||current.points.length+points.length>MAX_VERTICES){
      current.unsupported=true;return;
    }
    current.points.push(...points);
  }
  function finish(){
    if(!current)return;
    const unique=new Set(current.points.map(p=>p.latitude.toFixed(6)+','+p.longitude.toFixed(6)));
    if(current.unsupported||current.points.length<3||unique.size<3)skipped++;
    else if(regions.length<160)regions.push({name:current.name,
      category:current.category,lower:current.lower,upper:current.upper,
      points:current.points});
    else skipped++;
  }
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('*'))continue;
    const code=line.slice(0,2).toUpperCase(),value=line.slice(2).trim();
    if(code==='AC'){
      finish();current={name:'Bez názvu',category:value.slice(0,16),
        lower:'—',upper:'—',points:[],unsupported:false,center:null,clockwise:true};
      continue;
    }
    if(!current)continue;
    if(line.length>4000){current.unsupported=true;continue;}
    if(code==='AN'){current.name=value.slice(0,100);continue;}
    if(code==='AL'){current.lower=value.slice(0,60);continue;}
    if(code==='AH'){current.upper=value.slice(0,60);continue;}
    if(code==='V '){
      const setting=/^([DX])\s*=\s*(.+)$/i.exec(value);
      if(setting?.[1].toUpperCase()==='X')current.center=point(setting[2]);
      else if(setting?.[1].toUpperCase()==='D'){
        if(setting[2].trim()==='+')current.clockwise=true;
        else if(setting[2].trim()==='-')current.clockwise=false;
        else current.unsupported=true;
      }
      continue;
    }
    if(code==='DP'){append([point(value)].filter((p):p is Point=>p!==null));if(!point(value))current.unsupported=true;continue;}
    if(code==='DC'){
      const r=radius(value);
      // Circles cannot be combined with polygon/arc segments safely.
      if(!current.center||r===null||current.points.length){current.unsupported=true;continue;}
      append(circle(current.center,r));continue;
    }
    if(code==='DA'){
      const pieces=value.split(/\s*,\s*/);
      const r=pieces.length===3?radius(pieces[0]):null;
      const start=pieces.length===3?Number(pieces[1]):NaN;
      const end=pieces.length===3?Number(pieces[2]):NaN;
      if(!current.center||r===null||!/^(\d+(?:\.\d+)?)$/.test(pieces[1]??'')
        ||!/^(\d+(?:\.\d+)?)$/.test(pieces[2]??'')){
        current.unsupported=true;continue;
      }
      append(arc(current.center,r,start,end,current.clockwise));continue;
    }
    if(code==='DB'){
      const parts=value.split(/\s*,\s*/);
      const a=parts.length===2?point(parts[0]):null;
      const b=parts.length===2?point(parts[1]):null;
      if(!current.center||!a||!b){current.unsupported=true;continue;}
      const first=metersBetween(current.center,a)/1852;
      const second=metersBetween(current.center,b)/1852;
      const r=radius(String(first));
      if(r===null||Math.abs(first-second)>Math.max(.25,first*.05)){
        current.unsupported=true;continue;
      }
      const generated=arc(current.center,first,bearing(current.center,a),
        bearing(current.center,b),current.clockwise);
      if(generated){generated[0]=a;generated[generated.length-1]=b;}
      append(generated);continue;
    }
    if(code==='DY')current.unsupported=true;
  }
  finish();
  return {regions,skipped};
}
