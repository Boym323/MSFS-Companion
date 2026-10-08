export type GroundWay = {id:number;kind:'taxiway'|'taxilane';ref:string;
  points:{latitude:number;longitude:number}[]};
export type GroundMap = {ways:GroundWay[];holding:{latitude:number;longitude:number}[]};
const position=(p:{lat?:unknown;lon?:unknown})=>{
  const lat=p?.lat,lon=p?.lon;
  return typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)
    &&Math.abs(lat)<=85.05&&Math.abs(lon)<=180 ? {latitude:lat,longitude:lon} : null;
};
export function parseGroundMap(raw:unknown):GroundMap {
  if(!raw||typeof raw!=='object'||!('elements' in raw)||!Array.isArray(raw.elements))throw Error('Chybná odpověď OSM.');
  const ways:GroundWay[]=[];const holding:GroundMap['holding']=[];
  for(const element of raw.elements.slice(0,500)){
    if(!element||typeof element!=='object')continue;
    if(element.type==='way'&&Array.isArray(element.geometry)){
      const kind=element.tags?.aeroway;
      if(kind!=='taxiway'&&kind!=='taxilane')continue;
      if(element.geometry.length>250)continue;
      const points=element.geometry.map(position);
      if(points.length<2||points.some((p:unknown)=>p===null))continue;
      ways.push({id:Number.isSafeInteger(element.id)?element.id:ways.length,kind,
        ref:typeof element.tags?.ref==='string'?element.tags.ref.slice(0,32):'',
        points:points as GroundWay['points']});
    } else if(element.type==='node'&&element.tags?.aeroway==='holding_position'){
      const p=position(element);if(p)holding.push(p);
    }
  }
  return {ways:ways.slice(0,300),holding:holding.slice(0,100)};
}
export function groundQuery(lat:number,lon:number):string {
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85.05||Math.abs(lon)>180)
    throw Error('Neplatná poloha.');
  const around='(around:2500,'+lat.toFixed(5)+','+lon.toFixed(5)+')';
  return '[out:json][timeout:15];(way["aeroway"~"^(taxiway|taxilane)$"]'+around+
    ';node["aeroway"="holding_position"]'+around+');out geom 400;';
}
