export type Airspace = {name:string;category:string;lower:string;upper:string;
  points:{latitude:number;longitude:number}[]};
type Draft = Airspace & {unsupported:boolean};
function coordinate(value:string):number|null {
  const match=/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([NSEW])$/i.exec(value.trim());
  if(!match)return null;
  const d=Number(match[1]),m=Number(match[2]),s=Number(match[3]||0);
  if(!Number.isFinite(d)||m>=60||s>=60)return null;
  const axis=match[4].toUpperCase();
  if(d>(axis==='N'||axis==='S'?90:180))return null;
  const result=d+m/60+s/3600;
  if(result>(axis==='N'||axis==='S'?90:180))return null;
  return axis==='S'||axis==='W'?-result:result;
}
export function parseOpenAir(text:string):{regions:Airspace[];skipped:number} {
  if(text.length>2_000_000)throw Error('OpenAir soubor přesahuje 2 MB.');
  const regions:Airspace[]=[];let skipped=0;
  let current:Draft|null=null;
  function finish(){
    if(!current)return;
    if(current.unsupported||current.points.length<3)skipped++;
    else if(regions.length<160)regions.push({name:current.name,
      category:current.category,lower:current.lower,upper:current.upper,
      points:current.points});
    else skipped++;
  }
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('*'))continue;
    const code=line.slice(0,2).toUpperCase(),value=line.slice(2).trim();
    if(code==='AC'){finish();current={name:'Bez názvu',category:value.slice(0,16),
      lower:'—',upper:'—',points:[],unsupported:false};continue;}
    if(!current)continue;
    if(code==='AN')current.name=value.slice(0,100);
    if(code==='AL')current.lower=value.slice(0,60);
    if(code==='AH')current.upper=value.slice(0,60);
    if(['DA','DB','DC'].includes(code))current.unsupported=true;
    if(code==='DP'){
      // OpenAir DD:MM:SS N DD:MM:SS E; oblouky se záměrně nekreslí jako tětivy.
      const m=/^(\d{1,3}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?\s*[NS])\s+(\d{1,3}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?\s*[EW])$/i.exec(value);
      const latitude=m?coordinate(m[1]):null,longitude=m?coordinate(m[2]):null;
      if(latitude===null||longitude===null||current.points.length>=250)
        current.unsupported=true;
      else current.points.push({latitude,longitude});
    }
  }
  finish();
  return {regions,skipped};
}
