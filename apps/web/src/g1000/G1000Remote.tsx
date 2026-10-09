import { useEffect, useState } from 'react';
import {normalizeVerification,verificationKey,pilotReviewAllowed,
  type PilotResult,type VerificationMap} from './verification';
import './G1000Remote.css';

type Availability = {
  status: string; aircraft: string | null; checkedAt: string | null;
  availableActions: string[]; error: string | null;
};
type Action = { id: string; label: string; rotary: boolean };
const actions: Action[] = [
  { id: 'pfd.fms.inner', label: 'FMS malý', rotary: true },
  { id: 'pfd.fms.outer', label: 'FMS velký', rotary: true },
  { id: 'pfd.heading', label: 'Heading', rotary: true },
  { id: 'pfd.nav.inner', label: 'NAV malý', rotary: true },
  { id: 'pfd.nav.outer', label: 'NAV velký', rotary: true },
  { id: 'pfd.fpl', label: 'FPL', rotary: false },
  { id: 'pfd.proc', label: 'PROC', rotary: false },
  { id: 'pfd.ent', label: 'ENT', rotary: false },
  { id: 'pfd.cdi', label: 'CDI', rotary: false },
  { id: 'pfd.obs', label: 'OBS', rotary: false },
  { id: 'pfd.range', label: 'Range', rotary: true },
  { id: 'pfd.directto', label: 'Direct-To', rotary: false },
  { id: 'pfd.menu', label: 'Menu', rotary: false },
  { id: 'pfd.clr', label: 'CLR', rotary: false },
  { id: 'mfd.fms.inner', label: 'FMS malý', rotary: true },
  { id: 'mfd.fms.outer', label: 'FMS velký', rotary: true },
  { id: 'mfd.heading', label: 'Heading', rotary: true },
  { id: 'mfd.nav.inner', label: 'NAV malý', rotary: true },
  { id: 'mfd.nav.outer', label: 'NAV velký', rotary: true },
  { id: 'mfd.fpl', label: 'FPL', rotary: false },
  { id: 'mfd.proc', label: 'PROC', rotary: false },
  { id: 'mfd.ent', label: 'ENT', rotary: false },
  { id: 'mfd.cdi', label: 'CDI', rotary: false },
  { id: 'mfd.obs', label: 'OBS', rotary: false },
  { id: 'mfd.range', label: 'Range', rotary: true },
  { id: 'mfd.directto', label: 'Direct-To', rotary: false },
  { id: 'mfd.menu', label: 'Menu', rotary: false },
  { id: 'mfd.clr', label: 'CLR', rotary: false },
];
for (const display of ['pfd', 'mfd']) {
  for (let number = 1; number <= 12; number++) {
    actions.push({ id: display + '.softkey.' + number,
      label: 'Softkey ' + number, rotary: false });
  }
}

export default function G1000Remote({ live }: { live: boolean }) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedAction,setSelectedAction]=useState('');
  const [reviews,setReviews]=useState<VerificationMap>({});
  const aircraftKey=verificationKey(live?availability?.aircraft??null:null);
  const offered=availability?.status==='ready'?availability.availableActions:[];
  useEffect(()=>{
    setSelectedAction('');
    try{
      const raw=aircraftKey?window.localStorage.getItem(aircraftKey):null;
      setReviews(raw?normalizeVerification(JSON.parse(raw),Date.now()):{});
    }catch{setReviews({});}
  },[aircraftKey]);
  const setManualReview=(result:PilotResult)=>{
    if(!pilotReviewAllowed(live,availability?.status,availability?.aircraft,offered,selectedAction)
      ||!aircraftKey)return;
    const next=normalizeVerification({...reviews,
      [selectedAction]:{result,checkedAtUtc:new Date().toISOString()}},Date.now());
    try{window.localStorage.setItem(aircraftKey,JSON.stringify(next));setReviews(next);
      setFeedback('Ruční hodnocení uloženo v tomto prohlížeči.');}
    catch{setFeedback('Úložiště prohlížeče není dostupné. Hodnocení nebylo uloženo.');}
  };
  const clearManualReview=()=>{
    if(!selectedAction||!aircraftKey)return;
    const next={...reviews};delete next[selectedAction];
    try{window.localStorage.setItem(aircraftKey,JSON.stringify(next));setReviews(next);}
    catch{setFeedback('Změnu se nepodařilo uložit.');}
  };

  useEffect(() => {
    if (!live) { setAvailability(null); return; }
    let disposed = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/avionics/g1000', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json() as Availability;
        if (!disposed) setAvailability(data);
      } catch {
        if (!disposed) setAvailability(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [live]);

  async function send(id: string, value: number) {
    if (busy || !live || !availability?.availableActions.includes(id)) return;
    setBusy(true);
    try {
      const response = await fetch('/api/avionics/g1000/command', {
        method: 'POST', headers: {
          'Content-Type': 'application/json',
          'X-MSFS-Control-Token': window.sessionStorage.getItem('msfs-companion-control-session') ?? '',
        },
        body: JSON.stringify({ id, value }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Zapněte párování zařízení.'
        : response.status === 429 ? 'Počkejte před dalším povelem.'
        : 'Událost není podporována nebo SimConnect není dostupný.');
      setFeedback('Událost odeslána – chování ověřte na displeji letadla.');
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Chyba'); }
    finally { setBusy(false); }
  }

  return <section className="g1000-remote">
    <h2>G1000 · vzdálené ovládání</h2>
    <p>Dostupnost se zjišťuje přímo ze seznamu Input Events aktuálního letadla v MSFS 2020.
      Žádný nepodporovaný ovladač nelze aktivovat.</p>
    <p role="status">Stav: <strong>{!live ? 'Simulátor offline' :
      availability?.status === 'ready' ? 'Detekovány kompatibilní události' :
      availability?.status === 'unsupported' ? 'Pro letadlo nebyly nalezeny G1000 události' :
      availability?.status === 'unavailable' ? 'Input Events nyní nedostupné' : 'Načítám…'}</strong>
      {availability?.aircraft ? ` · ${availability.aircraft}` : ''}</p>
    <section className="g1000-manual-validation">
      <h3>C43 · Ruční ověření účinku Input Events</h3>
      <p>Enumerace události ani úspěšná HTTP odpověď neprokazuje změnu v kokpitu.
        Vyberte skutečně nabízený ovladač, vyzkoušejte jej v MSFS a výsledek
        označte výhradně podle vlastního pozorování. Uložení je pouze v tomto prohlížeči.</p>
      <label>Ověřovaná událost
        <select value={selectedAction} onChange={e=>setSelectedAction(e.target.value)}
          disabled={!live||offered.length===0}>
          <option value="">Vyberte dostupný ovladač…</option>
          {actions.filter(a=>offered.includes(a.id)).map(action=>
            <option key={action.id} value={action.id}>{action.id} · {action.label}</option>)}
        </select>
      </label>
      {selectedAction&&<p>Ruční záznam: {reviews[selectedAction]
        ?(reviews[selectedAction].result==='pass'?'Funguje':'Odchylka / nefunguje')+
          ' · '+new Date(reviews[selectedAction].checkedAtUtc).toLocaleString('cs-CZ')
        :'Dosud netestováno'}</p>}
      <div className="g1000-manual-buttons">
        <button type="button" disabled={!selectedAction||!live||!offered.includes(selectedAction)}
          onClick={()=>setManualReview('pass')}>Ručně potvrdit funkčnost</button>
        <button type="button" disabled={!selectedAction||!live||!offered.includes(selectedAction)}
          onClick={()=>setManualReview('fail')}>Zaznamenat odchylku</button>
        <button type="button" disabled={!selectedAction||!reviews[selectedAction]}
          onClick={clearManualReview}>Zrušit hodnocení</button>
      </div>
      <p>Uloženo {Object.keys(reviews).length} ručních hodnocení pro
        {' '}{availability?.aircraft??'neověřené letadlo'}. Po změně letadla se záznamy
        automaticky nepřenášejí.</p>
    </section>
    {(['pfd', 'mfd'] as const).map(display => <div className="g1000-section" key={display}>
      <h3>{display.toUpperCase()}</h3>
      <div className="g1000-grid">{actions.filter(a => a.id.startsWith(display + '.')).map(a => {
        const enabled = live && !busy && !!availability?.availableActions.includes(a.id);
        return <div className="g1000-control" key={a.id}>
          <span>{a.label} {!enabled && !availability?.availableActions.includes(a.id) ? '· nepodporováno' : ''}
            {enabled&&reviews[a.id]?' · '+(reviews[a.id].result==='pass'
              ?'ručně ověřeno':'ručně hlášená odchylka'):''}</span>
          {a.rotary ? <div className="g1000-buttons">
            <button type="button" disabled={!enabled} onClick={() => void send(a.id, -1)}
              aria-label={a.label + ' snížit'}>−</button>
            <button type="button" disabled={!enabled} onClick={() => void send(a.id, 1)}
              aria-label={a.label + ' zvýšit'}>+</button>
          </div> : <button type="button" disabled={!enabled} onClick={() => void send(a.id, 1)}>
            Stisk
          </button>}
        </div>;
      })}</div>
    </div>)}
    {feedback && <p role="status">{feedback}</p>}
    <p className="g1000-help">Příkaz je jen odeslaný Input Event, potvrzení změny není možné odvodit
      z HTTP odpovědi. U variant Garminu se mohou události lišit.</p>
  </section>;
}
