import type { Layout } from './layout';

export function recommendedAircraftLayout(aircraft:string|null|undefined):{
  name:string;layout:Layout
}|null{
  if(!aircraft||aircraft.length>100||/[\x00-\x1f]/.test(aircraft))return null;
  const name=aircraft.toLowerCase();
  if(/(?:a320|airbus.*320)/.test(name))
    return {name:'Airbus A320neo – společné PFD a mapa',
      layout:{columns:2,visible:['pfd','map','aircraft']}};
  return {name:'Univerzální – PFD / Mapa',
    layout:{columns:1,visible:['pfd','map']}};
}

export function aircraftLayoutStorageKey(aircraft:string|null|undefined):string|null{
  if(!aircraft||aircraft.length>100||/[\x00-\x1f]/.test(aircraft))return null;
  return 'msfs-companion-aircraft-layout-v1:'+encodeURIComponent(aircraft.trim());
}
