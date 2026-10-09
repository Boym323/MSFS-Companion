import type { Layout } from './layout';

export function recommendedAircraftLayout(aircraft:string|null|undefined):{
  name:string;layout:Layout
}|null{
  if(!aircraft||aircraft.length>100||/[\x00-\x1f]/.test(aircraft))return null;
  const name=aircraft.toLowerCase();
  if(/(?:a320|airbus.*320)/.test(name))
    return {name:'Airbus A320neo – PFD / Mapa / Airbus čtení',
      layout:{columns:2,visible:['pfd','map','a320']}};
  if(/(?:cessna\s*172|c172|skyhawk)/.test(name))
    return {name:'C172 – G1000 / PFD / Mapa',
      layout:{columns:2,visible:['pfd','map','g1000']}};
  if(/(?:tbm\s*9(?:30|40)|tbm930|tbm 930)/.test(name))
    return {name:'TBM – PFD / Mapa / Avionika',
      layout:{columns:2,visible:['pfd','map','avionics']}};
  if(/(?:x\s*cub|xcub|nx\s*cub)/.test(name))
    return {name:'XCub – PFD / Mapa / Systémy',
      layout:{columns:2,visible:['pfd','map','aircraft']}};
  return {name:'Univerzální – PFD / Mapa',
    layout:{columns:1,visible:['pfd','map']}};
}

export function aircraftLayoutStorageKey(aircraft:string|null|undefined):string|null{
  if(!aircraft||aircraft.length>100||/[\x00-\x1f]/.test(aircraft))return null;
  return 'msfs-companion-aircraft-layout-v1:'+encodeURIComponent(aircraft.trim());
}
