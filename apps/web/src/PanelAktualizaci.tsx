import { useEffect, useState } from 'react';

type StavAktualizace = {
  state: string;
  message: string;
  targetVersion?: string | null;
  currentVersion?: string;
  updatedAtUtc?: string;
};

/**
 * Ovládání pouze ze stejného webového původu. Backend vyžaduje
 * privátní LAN, odpovídající Origin a zvláštní hlavičku požadavku.
 * Žádný správcovský klíč, cookies ani přihlášení.
 */
export default function PanelAktualizaci() {
  const [stav, setStav] = useState<StavAktualizace | null>(null);
  const [zprava, setZprava] = useState('');
  const [ceka, setCeka] = useState(false);

  useEffect(() => {
    let zruseno = false;

    async function nacist() {
      try {
        const odpoved = await fetch('/api/admin/updates/status', {
          cache: 'no-store',
        });
        if (zruseno) return;
        if (odpoved.status === 404) {
          setZprava('Správa aktualizací je dostupná pouze přes nainstalovanou Windows aplikaci.');
          setStav(null);
          return;
        }
        if (odpoved.status === 403) {
          setZprava('Požadavek byl zamítnut. Připojte se přes adresu Windows PC ve stejné domácí síti.');
          setStav(null);
          return;
        }
        if (!odpoved.ok) throw new Error(`HTTP ${odpoved.status}`);
        setStav((await odpoved.json()) as StavAktualizace);
        setZprava('');
      } catch {
        if (!zruseno) setZprava('Nedaří se načíst stav aktualizací. Ověřte připojení k Windows PC.');
      }
    }

    void nacist();
    const casovac = window.setInterval(() => { void nacist(); }, 5000);
    return () => { zruseno = true; window.clearInterval(casovac); };
  }, []);

  async function vynutit() {
    if (ceka) return;
    setCeka(true);
    try {
      const odpoved = await fetch('/api/admin/updates/check', {
        method: 'POST',
        headers: { 'X-MSFS-Companion-Action': 'check-update' },
        cache: 'no-store',
      });
      if (odpoved.status === 403) throw new Error('Požadavek byl zamítnut kvůli síťovému omezení nebo původu stránky.');
      if (!odpoved.ok) throw new Error(`Požadavek se nepodařilo odeslat (HTTP ${odpoved.status}).`);
      setZprava('Požadavek na kontrolu byl odeslán. Stav se automaticky obnovuje.');
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
          <p>Kontrola a instalace aktualizací v domácí síti bez přihlašování.</p>
        </div>
      </div>
      <div className="update-status">
        <p><strong>Verze:</strong> {stav?.currentVersion ?? 'zjišťuji'}</p>
        <p><strong>Stav:</strong> {stav?.message ?? 'čekám na odpověď Windows aplikace'}</p>
        {stav?.targetVersion && <p><strong>Nová verze:</strong> {stav.targetVersion}</p>}
        <button type="button"
          disabled={ceka || stav?.state === 'applying' || !stav}
          onClick={() => void vynutit()}>
          {ceka ? 'Odesílám…' : 'Vynutit kontrolu a instalaci nové verze'}
        </button>
      </div>
      {zprava && <p className="update-notice" role="status">{zprava}</p>}
      <p className="update-hint">Dostupné jen ze stejné domácí podsítě. Každé zařízení v této síti může vyvolat aktualizaci. Neotevírejte port 8765 do internetu.</p>
    </section>
  );
}
