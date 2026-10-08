export type FuelPoint={at:number;gallons:number};
/** Derive burn only from 2+ minutes of continuous valid falling fuel readings. */
export function fuelPerformance(points:FuelPoint[],reserveMinutes:number) {
  const series=points.filter(p=>Number.isFinite(p.at)&&Number.isFinite(p.gallons)&&p.gallons>=0).slice(-40);
  if(series.length<3)return null;
  for(let i=1;i<series.length;i++){
    const dt=(series[i].at-series[i-1].at)/1000;
    // New aircraft, refill, teleport or tab sleeping invalidates the evidence.
    if(dt<=0||dt>35||series[i].gallons>series[i-1].gallons+0.05)return null;
  }
  const first=series[0],last=series[series.length-1];
  const seconds=(last.at-first.at)/1000;
  if(seconds<120)return null;
  const used=first.gallons-last.gallons;
  if(used<=0.03)return null;
  const gph=used*3600/seconds;
  if(gph<0.1||gph>2000)return null;
  const remainHours=last.gallons/gph;
  const reserveHours=Math.max(0,Math.min(120,reserveMinutes))/60;
  return {burnGallonsPerHour:gph,enduranceHours:remainHours,
    afterReserveHours:Math.max(0,remainHours-reserveHours),
    evidenceMinutes:seconds/60};
}
