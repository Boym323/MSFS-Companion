/** Display-only mapping; status is authoritative in the Windows bridge.
 * A failed or missing ACK must never be described as an installed module.
 */
export type WasmHeartbeatStatus =
 'waiting_sim'|'waiting_aircraft'|'checking'|'connected'|'unavailable'|'error';
export function wasmHeartbeatLabel(state:WasmHeartbeatStatus|null|undefined,
 moduleReady:boolean):string{
 if(state==='connected'&&moduleReady)return 'OK';
 switch(state){
  case 'waiting_sim':return 'ČEKÁ NA MSFS';
  case 'waiting_aircraft':return 'ČEKÁ NA A320';
  case 'checking':return 'OVĚŘUJI';
  case 'connected':return 'OVĚŘUJI';
  case 'unavailable':return 'BEZ ODEZVY';
  case 'error':return 'CHYBA';
  default:return 'NAČÍTÁM';
 }
}
export function wasmHeartbeatError(error:string|null|undefined):string{
 switch(error){
  case 'ack_timeout':return 'Modul neodpověděl na ping. Ověř instalaci do Community a restartuj MSFS.';
  case 'DllNotFoundException':return 'Knihovna SimConnect.dll není dostupná na Windows hostiteli.';
  case 'PlatformNotSupportedException':return 'Ověřování potřebuje Windows PC s MSFS 2020.';
  case 'COMException':return 'SimConnect vrátil chybu při komunikaci.';
  case 'cancelled':return 'Ověření bylo přerušeno.';
  case null:case undefined:case '':return 'Bez evidované chyby.';
  default:return 'Ověření selhalo ('+String(error).slice(0,70)+').';
 }
}
export function wasmHeartbeatTime(value:string|null|undefined):string{
 if(!value)return '—';
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString('cs-CZ'):'—';
}
