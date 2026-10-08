import { useEffect, useState } from 'react';

type StavAktualizace = {
  state: string;
  message: string;
  targetVersion?: string | null;
  currentVersion?: string;
  updatedAtUtc?: string;
};

const KLIC = 'msfs-companion-admin-token';

/**
 * Příkazy odesíláme pouze do stejného původu jako dashboard.
 * Vzdálený přístup musí být zajištěn soukromým tunelem (např. Tailscale Serve).
 * Bez klíče Windows hostitele se nic nespustí.
 */
export default function PanelAktualizaci() {
  const [klic, setKlic] = useState(() =>
    window.sessionStorage.getItem(KLIC) ?? window.localStorage.getItem(KLIC) ?? '');
  const [ulozitKlic, setUlozitKlic] = useState(() => window.localStorage.getItem(KLIC) !== null);
  const [overenyKlic, setOverenyKlic] = useState(() =>
    window.sessionStorage.getItem(KLIC) ?? window.localStorage.getItem(KLIC) ?? '');
  const [stav, setStav] = useState<StavAktualizace | null>(null);
  const [zprava, setZprava] = useState('');
  const [ceka, setCeka] = useState(false);

  useEffect(() => {
    if (!overenyKlic) {
      setStav(null);
      return;
    }
    let zruseno = false;
    const nacist = async () => {
      try {
        const odpoved = await fetch('/api/admin/updates/status', {
          headers: { Authorization: `Bearer ${overenyKlic}` },
          cache: 'no-store',
        });
        if (zruseno) return;
        if (odpoved.status === 401) {
          setZprava('Nesprávný správcovský klíč. Zkopírujte jej z nabídky Windows aplikace.');
          setStav(null);
          return;
        }
        if (odpoved.status === 404) {
          setZprava('Správa aktualizací není u tohoto bridge dostupná. Je nutná nainstalovaná Windows aplikace.');
          setStav(null);
          return;
        }
        if (!odpoved.ok) throw new Error(`HTTP ${odpoved.status}`);
        setStav((await odpoved.json()) as StavAktualizace);
        setZprava('');
      } catch {
        if (!zruseno) setZprava('Nelze načíst stav aktualizací. Zkontrolujte spojení s Windows bridge.');
      }
    };
    void nacist();
    const casovac = window.setInterval(() => { void nacist(); }, 5000);
    return () => { zruseno = true; window.clearInterval(casovac); };
  }, [overenyKlic]);

  function nastavitKlic() {
    const hodnota = klic.trim();
    if (!/^[A-Fa-f0-9]{64}$/.test(hodnota)) {
      setZprava('Klíč musí mít 64 hexadecimálních znaků.');
      return;
    }
    const presny = hodnota.toUpperCase();
    if (ulozitKlic) {
      window.localStorage.setItem(KLIC, presny);
      window.sessionStorage.removeItem(KLIC);
    } else {
      window.sessionStorage.setItem(KLIC, presny);
      window.localStorage.removeItem(KLIC);
    }
    setOverenyKlic(presny);
    setZprava('');
  }

  function odpojit() {
    window.localStorage.removeItem(KLIC);
    window.sessionStorage.removeItem(KLIC);
    setOverenyKlic('');
    setKlic('');
    setStav(null);
    setZprava('');
  }

  async function vynutit() {
    if (!overenyKlic || ceka) return;
    if (!window.confirm('Zkontrolovat aktualizace na Windows PC? Pokud existuje nová verze, Companion se krátce restartuje. Samotný MSFS zůstane spuštěný.'))
      return;

    setCeka(true);
    try {
      const odpoved = await fetch('/api/admin/updates/check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${overenyKlic}` },
        cache: 'no-store',
      });
      if (odpoved.status === 401) throw new Error('Správcovský klíč není platný.');
      if (!odpoved.ok) throw new Error(`Požadavek se nepodařilo odeslat (HTTP ${odpoved.status}).`);
      setZprava('Požadavek byl přijat. Stav se automaticky obnovuje každých 5 sekund.');
    } catch (chyba) {
      setZprava(chyba instanceof Error ? chyba.message : 'Požadavek se nezdařil.');
    } finally {
      setCeka(false);
    }
  }

  return (
    <section className="update-panel" aria-label="Správa aktualizací">
      <div className="update-heading">
        <div>
          <h2>Správa Windows aplikace</h2>
          <p>Aktualizace z webu vyžadují správcovský klíč. Při aktualizaci se restartuje pouze Companion.</p>
        </div>
        {overenyKlic && <button type="button" className="update-secondary" onClick={odpojit}>Odpojit správu</button>}
      </div>
      {!overenyKlic ? (
        <div className="update-form">
          <label htmlFor="admin-token">Správcovský klíč z nabídky Windows aplikace</label>
          <input id="admin-token" type="password" autoComplete="off" value={klic}
            placeholder="Vložte klíč pro správu" onChange={(e) => setKlic(e.target.value)} />
          <label className="update-checkbox">
            <input type="checkbox" checked={ulozitKlic} onChange={(e) => setUlozitKlic(e.target.checked)} />
            Zapamatovat na tomto zařízení (jen na důvěryhodném počítači)
          </label>
          <button type="button" onClick={nastavitKlic}>Připojit správu</button>
        </div>
      ) : (
        <div className="update-status">
          <p><strong>Verze:</strong> {stav?.currentVersion ?? 'zjišťuji'}</p>
          <p><strong>Stav:</strong> {stav?.message ?? 'čekám na odpověď Windows aplikace'}</p>
          {stav?.targetVersion && <p><strong>Nová verze:</strong> {stav.targetVersion}</p>}
          <button type="button" disabled={ceka || stav?.state === 'applying'} onClick={() => void vynutit()}>
            {ceka ? 'Odesílám…' : 'Vynutit kontrolu a instalaci nové verze'}
          </button>
        </div>
      )}
      {zprava && <p className="update-notice" role="status">{zprava}</p>}
      <p className="update-hint">Z jiného zařízení se připojujte pouze přes soukromý zabezpečený tunel. Bez nové dostupné verze se nic nepřeinstaluje.</p>
    </section>
  );
}
