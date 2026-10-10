import { useMemo, useState } from 'react';

type LogSnapshot = {
  available: boolean;
  truncated: boolean;
  lines: string[];
  generatedAt: string;
};

const isImportant = (line: string) =>
  /\b(error|warning|failed|failure|exception|timeout|disconnect|reconnect|stale|restart|stopped|killed|crash)\b|odpojen|výpad|chyba|selhal|restart|připojení/i.test(line);

// Explicitly requested by the user. No background polling or extra network
// requests if the log section is collapsed.
export default function WindowsHostLogPanel() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<LogSnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [importantOnly, setImportantOnly] = useState(false);

  const filtered = useMemo(() =>
    (snapshot?.lines ?? []).filter(line => !importantOnly || isImportant(line)),
  [snapshot, importantOnly]);

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/health/windows-host-log?lines=250', { cache: 'no-store' });
      if (response.status === 404) {
        setSnapshot(null);
        setMessage('Diagnostický log je dostupný jen v nainstalovaném Windows hostiteli.');
        return;
      }
      if (!response.ok) throw new Error('Záznamy se nepodařilo načíst.');
      const data = await response.json() as LogSnapshot;
      setSnapshot(data);
      if (!data.available) setMessage('Soubor windows-host.log není dostupný nebo ještě nevznikl.');
    } catch {
      setMessage('Záznamy se nepodařilo načíst. Ověřte spojení s Windows bridge.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (visible) { setVisible(false); return; }
    setVisible(true);
    void refresh();
  };

  const save = () => {
    if (!snapshot?.available) return;
    const blob = new Blob([filtered.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'kokpit-windows-host-ocisteny-log.txt';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const copy = async () => {
    if (!snapshot?.available) return;
    if (!navigator.clipboard?.writeText) {
      setMessage('Kopírování vyžaduje podporovaný bezpečný kontext. Použijte Stažení TXT.');
      return;
    }
    try {
      await navigator.clipboard.writeText(filtered.join('\n'));
      setMessage('Očištěné záznamy byly zkopírovány.');
    } catch {
      setMessage('Kopírování prohlížeč zablokoval. Použijte Stažení TXT.');
    }
  };

  return <section className="host-log-panel" aria-label="Diagnostický log Windows">
    <div className="host-log-heading">
      <div>
        <h3>Windows host · události a chyby</h3>
        <p>Poslední záznamy z windows-host.log. Citlivé údaje se před odesláním do prohlížeče odstraňují.</p>
      </div>
      <button type="button" onClick={toggle} aria-expanded={visible}>
        {visible ? 'Skrýt log' : 'Zobrazit log'}
      </button>
    </div>
    {visible && <>
      <div className="host-log-toolbar">
        <button type="button" onClick={() => void refresh()} disabled={busy}>
          {busy ? 'Načítám…' : 'Obnovit'}
        </button>
        <label><input type="checkbox" checked={importantOnly}
          onChange={event => setImportantOnly(event.target.checked)} /> Pouze důležité události</label>
        <button type="button" onClick={() => void copy()} disabled={!snapshot?.available}>Kopírovat</button>
        <button type="button" onClick={save} disabled={!snapshot?.available}>Stáhnout TXT</button>
      </div>
      {message && <p role="status" className="host-log-message">{message}</p>}
      {snapshot?.available && <>
        <p className="host-log-meta">
          {filtered.length} záznamů
          {snapshot.truncated ? ' · zobrazen jen konec souboru' : ''}
          {' · '}Načteno: {new Date(snapshot.generatedAt).toLocaleTimeString('cs-CZ')}
        </p>
        <pre className="host-log-lines" aria-label="Očištěný výpis diagnostiky">
          {filtered.length > 0 ? filtered.join('\n') : 'Žádné odpovídající záznamy.'}
        </pre>
      </>}
    </>}
  </section>;
}
