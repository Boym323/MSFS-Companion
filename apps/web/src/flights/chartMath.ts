export function downsampleSeries(values:number[],maxPoints=600):{index:number;value:number}[]{
  if(values.length===0)return [];
  const count=Math.max(2,Math.min(800,Math.round(maxPoints)));
  const stride=Math.max(1,Math.ceil((values.length-1)/(count-1)));
  const selected:{index:number;value:number}[]=[];
  for(let index=0;index<values.length;index+=stride){
    if(Number.isFinite(values[index]))selected.push({index,value:values[index]});
  }
  if(values.length>1 && (selected.at(-1)?.index)!==values.length-1 &&
      Number.isFinite(values.at(-1)))selected.push({index:values.length-1,value:values.at(-1)!});
  return selected;
}
export function seriesPath(values:number[],width=600,height=68):string{
  const points=downsampleSeries(values);
  if(points.length<2)return '';
  let min=Infinity,max=-Infinity;
  for(const p of points){min=Math.min(min,p.value);max=Math.max(max,p.value);}
  const range=Math.max(max-min,1);
  return points.map((p,i)=>{
    const x=10+p.index*Math.max(0,width-20)/Math.max(1,values.length-1);
    const y=8+(1-(p.value-min)/range)*height;
    return (i?'L':'M')+' '+x.toFixed(1)+' '+y.toFixed(1);
  }).join(' ');
}
