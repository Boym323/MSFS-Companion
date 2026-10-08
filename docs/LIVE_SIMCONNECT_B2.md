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

Subscription dostává data každým simulačním snímkem; bridge je
předává nanejvýš **20× za sekundu**. Skutečná dosažená frekvence
závisí na výkonu a snímkové frekvenci MSFS.

Pokud simulátor není zapnutý, vypne se nebo přestane posílat
platné snímky, bridge označí data jako neplatná, vyčistí poslední
snímek a každé tři sekundy zkouší navázat spojení znovu.
Bez spojení **se automaticky nepřepíná na fiktivní hodnoty**.

## Stavový endpoint

`GET /api/status` vrací vedle původních `status`, `mode`,
`simulator`, `connected` a `lastTelemetryUtc` také:

- `connectionState`: `waiting`, `connecting`, `connected` nebo `stale`.
- `sampleAgeMs`: stáří posledního skutečného snímku.
- `sampleRateHz`: průběžný odhad publikovaných snímků za sekundu.
- `samplesReceived`: počet dosud přijatých platných vzorků.
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
5. V dashboardu očekávejte **SIMCONNECT LIVE** a reálné údaje.
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

- Skutečná stabilita odběru 20 Hz během delšího letu.
- Znaménková konvence `PLANE PITCH DEGREES` a `PLANE BANK DEGREES`
  pro budoucí PFD. Nyní se vrací přímo hodnoty SimConnect,
  nikoli neověřená korekce.
- Stavy pauzy, přepnutí letadla a návrat z hlavního menu.
- Ovládací události, LVars a vstupní prvky letadel.

Z důvodu těchto omezení je B2 určeno zatím pro vývoj a
nepoužívejte dashboard jako certifikovaný letový přístroj.
