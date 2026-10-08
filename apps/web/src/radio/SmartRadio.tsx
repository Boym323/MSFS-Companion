import {useEffect,useState} from 'react';
import {allowedComStandby,comFrequencies,type AirportFrequency} from './radioMath';
import './SmartRadio.css';
const key='msfs-companion-control-session';
type Airport={frequencies:AirportFrequency[];airport:{name:string;ident:string}};
type ControlStatus={canControl:boolean;enabled:boolean;paired:boolean};
type Radio={connected:boolean;radios:{com1StandbyMHz:number}|null};
export default function SmartRadio({live}:{live:boolean}){
  const [input,setInput]=useState('LKPR');
  const [icao,setIcao]=useState('LKPR');
  const [airport,setAirport]=useState<Airport|null>(null);
  const [access,setAccess]=useState<ControlStatus|null>(null);
  const [radio,setRadio]=useState<Radio|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    setAirport(null);
    void fetch('/api/map/aviation/airport/'+encodeURIComponent(icao),
      {cache:'no-store',signal:abort.signal})
      .then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<Airport>;})
      .then(d=>{if(!abort.signal.aborted)setAirport(d);})
      .catch(()=>{if(!abort.signal.aborted)setMessage('Letištní katalog se načítá nebo nemá tento kód.');});
    return()=>abort.abort();
  },[icao]);
  useEffect(()=>{
    let closed=false;
    const refresh=async()=>{
      const token=window.sessionStorage.getItem(key)||'';
      try {
        const [a,b]=await Promise.all([
          fetch('/api/controls/status',{headers:{'X-MSFS-Control-Token':token},cache:'no-store'}),
          fetch('/api/radios',{cache:'no-store'})
        ]);
        if(!a.ok||!b.ok)throw Error();
        const status=await a.json() as ControlStatus;
        const read=await b.json() as Radio;
        if(!closed){setAccess(status);setRadio(read);}
      }catch{if(!closed){setAccess(null);setRadio(null);}}
    };
    void refresh();const t=window.setInterval(()=>void refresh(),2500);
    return()=>{closed=true;clearInterval(t);};
  },[]);
  async function tune(freq:number){
    const hz=allowedComStandby(freq);
    if(hz===null||!live||!access?.canControl||busy)return;
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/controls/command',{
        method:'POST',
        headers:{'Content-Type':'application/json',
          'X-MSFS-Control-Token':window.sessionStorage.getItem(key)||''},
        body:JSON.stringify({command:'radio.com1.set',value:hz})
      });
      if(!response.ok)throw Error('Naladění odmítnuto (HTTP '+response.status+').');
      setMessage('Povel k nastavení COM1 standby odeslán. Potvrďte výsledek zpětným čtením nebo v MSFS.');
    }catch(error){setMessage(error instanceof Error?error.message:'Nepodařilo se odeslat příkaz.');}
    finally{setBusy(false);}
  }
  const freqs=comFrequencies(airport?.frequencies??[]);
  return <section className="smart-radio">
    <h2>C27 · Smart Radio Assistant</h2>
    <p>Zobrazuje zveřejněné frekvence OurAirports. Žádné automatické ladění;
      každý příkaz COM1 standby vyžaduje kliknutí a oprávnění stávajícího bridge.</p>
    <form onSubmit={e=>{e.preventDefault();if(/^[A-Z]{4}$/.test(input))setIcao(input);}}>
      <label>ICAO letiště <input value={input} maxLength={4} onChange={e=>
        setInput(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}/></label>
      <button type="submit" disabled={!/^[A-Z]{4}$/.test(input)}>Načíst frekvence</button>
    </form>
    <p role="status">COM1 standby (MSFS): {radio?.connected&&radio.radios
      ?radio.radios.com1StandbyMHz.toFixed(3)+' MHz':'—'}
      {' · '}Ovládání: {live&&access?.canControl?'Povoleno':'Nedostupné'}</p>
    {message&&<p role="status">{message}</p>}
    <div className="smart-radio-grid">
      {freqs.map((frequency,index)=><article key={index}>
        <strong>{frequency.type} · {frequency.frequencyMhz.toFixed(3)} MHz</strong>
        <span>{frequency.description||'Bez popisu'}</span>
        <button type="button" disabled={!live||!access?.canControl||busy}
          onClick={()=>void tune(frequency.frequencyMhz)}>Nastavit COM1 standby</button>
      </article>)}
      {!freqs.length&&<p>Čekám na letištní databázi nebo pro letiště nejsou
        dostupné frekvence podporované naším SimConnect ovládáním.</p>}
    </div>
    <p>Frekvence mohou být zastaralé. Hodnota se vždy znovu kontroluje na backendu
      a nejde automaticky do aktivního rádia.</p>
  </section>;
}
