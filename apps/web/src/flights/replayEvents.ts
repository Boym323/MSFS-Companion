/** Find the recorded point corresponding to an analytically detected event.
 * No interpolation through gaps, no synthetic GPS coordinates.
 */
export function eventSampleIndex(samples:readonly {timestampUtc:string}[],eventAt:string):number|null{
  const target=Date.parse(eventAt);
  if(!Number.isFinite(target))return null;
  let best=-1,delta=Infinity;
  for(let i=0;i<samples.length;i++){
    const ms=Date.parse(samples[i].timestampUtc);
    if(!Number.isFinite(ms))continue;
    const distance=Math.abs(ms-target);
    if(distance<delta){best=i;delta=distance;}
  }
  // The event must coincide with a known sample, not a fabricated point.
  return best>=0&&delta<=1000?best:null;
}
