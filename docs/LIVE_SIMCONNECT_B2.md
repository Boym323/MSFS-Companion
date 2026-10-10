# B2 – živá telemetrie MSFS 2020

## Co funguje

Nainstalovaný Windows MSFS Companion spouští bridge v režimu
`simconnect`. Po spuštění hledá běžící MSFS 2020 a při dostupném
simulátoru otevře spojení přes `SimConnect.NET` 0.2.2.

Čte **pouze letová data**, nikdy neposílá příkazy ovládání.
Používá **jednu strukturovanou SimConnect subscription** pro:
zeměpisnou šířku a délku, IAS, indikovanou výšku, vertikální
rychlost, magnetický kurz, klopení a náklon. Volitelně jednou
při připojení čte `TITLE` pro název aktuálního letadla.

## B2.3 – optimalizace pro MSFS uzamčený na 30 FPS

SimConnect přijímá **každý platný simulační snímek**, bez původního
50ms omezení přímo v callbacku. Přijatá data se ukládají do
**jednoslotové fronty**, která nikdy neblokuje simulátor.

Nezávislý 50ms časovač vybírá nejnovější dosud nepředaný snímek
a aktualizuje datový most nanejvýš **20× za sekundu**.
Při stabilních 30 FPS tedy očekáváme přibližně **30 Hz příjmu
a 20 Hz předávání**. Zhruba 10 z 30 snímků se **záměrně přeskočí**;
nejsou považované za ztrátu spojení nebo chybu.

Pokud zdroj neposlal nic nového, nedochází k opětovnému publikování
staré telemetrie. Stejně tak WebSocket zbytečně neposílá duplicitní
snímky. Pro budoucí 60FPS PFD plánujeme **interpolaci pouze
na straně vykreslování**, nikoliv falšování zdrojové frekvence.

**Dosažení 20 Hz není garantované:** závisí na skutečné frekvenci
SimFrame callbacků a plánování časovačů Windows. Vývojová
diagnostika odděleně ukazuje frekvenci příjmu a předávání.

Pokud simulátor není zapnutý, vypne se nebo přestane posílat
platné snímky, bridge označí data jako neplatná, vyčistí poslední
snímek a každé tři sekundy zkouší navázat spojení znovu.
Bez spojení **se automaticky nepřepíná na fiktivní hodnoty**.

## Stavový endpoint

`GET /api/status` vrací vedle původních `status`, `mode`,
`simulator`, `connected` a `lastTelemetryUtc` také:

- `connectionState`: `waiting`, `connecting`, `connected` nebo `stale`.
- `sampleAgeMs`: stáří posledního skutečného snímku.
- `sampleRateHz`: publikované **unikátní** snímky za sekundu (cílově 20 Hz).
- `incomingRateHz`: skutečná frekvence platných příchozích snímků ze SimConnect.
- `samplesReceived`: počet platných vzorků **přijatých** z MSFS.
- `samplesPublished`: počet nových snímků skutečně **předaných** do `TelemetryStore`.
- `framesSkipped`: počet snímků záměrně přeskočených při převzorkování.
- `publicationLagMs`: doba **od příjmu callbacku do publikování** v bridge, nikoliv celková latence simulátoru nebo sítě.
- `connectionAttempts`: počet pokusů o připojení.
- `lastError`: stručný popis posledního selhání (nebo `null`).

Web `/admin` zobrazuje **SIMCONNECT LIVE**, aktuální frekvenci
a stáří vzorku. Při ztrátě spojení zobrazí **ČEKÁM NA MSFS**
a číselné údaje skryje, místo aby je vydával za živé.
WebSocket `/ws` používá stále stejné pole telemetrie jako v B1.

## Režimy

| Spuštění | Výchozí režim |
| --- | --- |
| Windows instalátor / tray | `simconnect` – skutečná data |
| `dotnet run --project apps/bridge` | `mock` – vývojová data |
| Výslovné `MSFS_COMPANION_TELEMETRY_MODE=mock` | `mock` |
| Výslovné `MSFS_COMPANION_TELEMETRY_MODE=simconnect` | `simconnect` |

V nabídce Windows aplikace vedle hodin je také přepínač
**Zdroj letových dat → SimConnect – skutečný MSFS / Mock – testovací
hodnoty**. Volba se zapamatuje. Při změně se na okamžik restartuje
jen bridge, nikoli MSFS. Pro dočasné ladění má přednost explicitně
nastavená proměnná prostředí před uloženou volbou.

Režim se přepíná **při startu bridge**. Při běhu simulátoru
se vývojový mock nezapíná automaticky jako záloha, protože by
přístroje ukazovaly vymyšlené údaje.

## Ověření na Windows PC

1. Zkontrolujte, že máte nejnovější MSFS Companion z Releases.
2. Otevřete `http://127.0.0.1:8765/admin`.
3. Dokud MSFS neběží, ověřte stav **ČEKÁM NA MSFS**.
4. Spusťte MSFS 2020, načtěte Cessnu 172 do letu.
5. V dashboardu očekávejte **SIMCONNECT LIVE**, reálné údaje a
   zvlášť frekvenci **příjmu** a **publikování**.
   Při stabilním zámku simulátoru na 30 FPS cílujeme na ~30/~20 Hz;
   přibližně 10 přeskočených snímků za sekundu je normální.
6. Ověřte IAS, výšku, kurz a GPS pohybem letadla. Změny
   klopení a náklonu porovnejte s přístroji MSFS.
7. Zavřete simulátor a ověřte, že se čísla skryjí, stav přejde
   na čekání a po opětovném spuštění dojde k reconnectu.
8. Při potížích zkopírujte z Windows diagnostický log:
   `%LOCALAPPDATA%\MSFS Companion\windows-host.log`.

Většina kroků se dá sledovat z Macu na adrese Windows PC v domácí
síti, ale **první skutečný test se spuštěným MSFS a reconnect
nelze nahradit testy GitHub Actions**.

## Dosud neověřeno

- Stabilita nového příjmu/předávání během delšího letu zatím
  čeká na ověření na Windows PC.
- Uživatel v MSFS 2020 potvrdil znaménkovou konvenci:
  **kladné klopení = příď dolů**, **kladný náklon = levé křídlo dolů**.
  Pro PFD se znaménka převedou až ve vykreslovací vrstvě.
- Stavy pauzy, přepnutí letadla a návrat z hlavního menu.
- Ovládací události, LVars a vstupní prvky letadel.

Z důvodu těchto omezení je B2 určeno zatím pro vývoj a
nepoužívejte dashboard jako certifikovaný letový přístroj.

## Oprava TITLE a opakovaného připojování

Původní skalární volání `GetAsync<string>("TITLE", "")` /
`Subscribe<string>("TITLE", "")` vyvolávalo výjimku knihovny
SimConnect.NET (`ArgumentException: unit`). Následná změna na
`"string"` obešla toto ověření, ale nativní SimConnect SDK pro
textovou proměnnou vyžaduje **prázdnou jednotku**.

Proto obě cesty nyní používají `SimConnectAircraftTitleData`:
strukturovaný `String256` s `[SimConnect("TITLE", "", ...)]`.
Tato cesta posílá do nativního SDK skutečně prázdnou jednotku
a neprochází skalárním validátorem argumentu `unit`.

Bridge a MSFS mají v horním panelu oddělené stavy. Po aktualizaci
Windows instalace spusťte MSFS 2020, načtěte let a ověřte
`SIMCONNECT LIVE`, reálnou telemetrii i změnu názvu letadla
bez převzetí starých hodnot. CI ověřuje layout String256 a
kontrakt jednotky, skutečné potvrzení vyžaduje Windows s MSFS.

## Stabilita po A320-01: identita není životní podmínkou PFD

Dřívější verze ukončovala celé SimConnect spojení, pokud 1Hz
subscription `TITLE` neaktualizovala identitu do 10 sekund, nebo
pokud se její odběr ukončil. To vyvolávalo opakované reconnecty
navzdory zdravým letovým SimFrames.

Nyní jsou dvě nezávislé podmínky:

- **PFD / mapa / letová telemetrie** běží podle živých validních SimFrame
  (6s watchdog); stale nebo dočasně nedostupné TITLE ji nevypíná.
- **Povely do kokpitu a ověřený A320 readback** vyžadují čerstvé, shodné
  TITLE (10 sekund). Prázdná hodnota okamžitě odnímá důvěru. Při
  ukončeném TITLE odběru se ovládání zablokuje a odběr zkusí obnovit
  po 5 sekundách. Potvrzená změna názvu letadla dál vynutí nový
  SimConnect session kvůli odstranění starých aircraft subscriptions.

Při podezření na výpadek otevřete `/api/status`:
pokud `connectionAttempts` roste spolu s `lastError`, zkontrolujte
`%LOCALAPPDATA%\\MSFS Companion\\windows-host.log`.
Pokud stabilně přijímáte `incomingRateHz`, ale `/api/aircraft/identity`
hlásí `trusted=false`, jde o problém pomalého TITLE readeru, ne o
pád základního spojení. Ověření na skutečném MSFS 2020 je stále nutné.
