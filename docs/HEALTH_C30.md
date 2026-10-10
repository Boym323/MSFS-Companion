# C30 – System Health Center

Samostatná stránka `/health` čte každých 10 s `/api/health/overview`. Používá existující singletony a poslední známé stavy SimConnect, systémových SimVars, OurAirports, NOAA, VATSIM, rádií a GPS. **Nevytváří nové spojení s internetovými službami** a neodesílá žádné povely simulátoru.

Stav `configured` mDNS **není důkazem**, že UDP 5353 multicast skutečně funguje. `cachedAirports` NOAA není test aktuální dostupnosti služby a režim mock je označen jako `test`, nikoli simulátor online.

Export JSON z prohlížeče zahrnuje pouze agregované metriky, názvy diagnostických stavů a stáří cache, nikoli GPS trasu, názvy letů, IP adresy či systémové cesty. Citlivý log s podrobnostmi sdílejte až po kontrole.

HTTP smoke regresní test ověřuje přítomnost jednotlivých údajů i ve vývojovém mock režimu. První skutečný test připojení k iPadu/MSFS proběhne na Windows.

## Diagnostický log hostitele ve webu

Na `/health` je rozbalitelná sekce **Windows host · události a chyby**.
Na požádání čte read-only `GET /api/health/windows-host-log?lines=250`.
Endpoint je dostupný jen s nastavením instalovaného Windows hostitele;
samostatný vývojový bridge vrací 404. Bez otevřené sekce není žádný
pravidelný logový polling.

Server čte **pouze pevně daný soubor**
`%LOCALAPPDATA%\\MSFS Companion\\windows-host.log` (bez cesty v dotazu),
maximálně posledních 128 KiB a 300 řádků. Před odesláním omezuje
délku řádků a maskuje přihlašovací tokeny, URL secrets, e-maily,
uživatelská jména v cestách a IP adresy. HTML se nevkládá do DOM;
React text escapuje. API vrací `no-store`.
Přístup je v rámci stejné důvěryhodné LAN jako ostatní čtecí API,
nejde o internetové publikování logů.

V rozhraní lze filtrovat chyby, ručně obnovit, kopírovat očištěné
záznamy a stáhnout očištěný TXT. Výpis je záměrně omezený; při
forenzním auditu na Windows je nutné projít původní lokální soubor.
Prohlížeče přes nešifrované HTTP v LAN mohou blokovat Clipboard API;
TXT export pak zůstává funkční.

Windows host rotuje `windows-host.log` při 4 MiB do jediného
`windows-host.log.old` (nejvýše přibližně 8 MiB pro oba soubory).
Web ukazuje pouze aktivní log, ne archiv.

Stabilizace LAN: hostitel během 10s health ticku upřednostňuje
již navázanou privátní IPv4 adresu i tehdy, pokud se změní pořadí
výpisu síťových adaptérů. Opravdová ztráta aktivní adresy vede
k novému výběru a restartu bridge, nikoli však pouhá změna pořadí.
