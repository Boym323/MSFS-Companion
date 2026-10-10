/** Airbus workspace tabs are navigation state, never SimConnect control state. */
export const A320_TABS=[
 {id:'fcu',label:'FCU',description:'Letové řízení a nastavení referencí'},
 {id:'nd',label:'EFIS / ND',description:'Navigace a mapové zobrazení'},
 {id:'overhead',label:'Overhead',description:'Světla a systémové indikace'},
 {id:'ecam',label:'ECAM',description:'Motory, APU a palivo'},
 {id:'mcdu',label:'MCDU',description:'GPS Companion a stav integrace'},
 {id:'diagnostics',label:'Diagnostika',description:'Ověření dat a testy'}] as const;
export type A320Tab=(typeof A320_TABS)[number]['id'];
export function normalizeA320Tab(id:string|null|undefined):A320Tab{
 return A320_TABS.find(tab=>tab.id===id)?.id??'fcu';
}
export function selectedA320Tab(search:string):A320Tab{
 return normalizeA320Tab(new URLSearchParams(search).get('panel'));
}
export function a320PanelUrl(id:A320Tab,search=''):string{
 const p=new URLSearchParams(search);
 p.set('panel',id);
 return '/a320?'+p.toString();
}
