# GitHub Actions – režimy CI

## Běžný pull request

Workflow `.github/workflows/ci.yml` se spouští při každém PR a podle
rozdílu vůči cílové větvi vyhodnotí změněné moduly.

- `bridge`: sestavení backendu a jen odpovídající .NET testy; mock HTTP
  smoke test při změně běhového kódu.
- `web`: sestavení Reactu a rychlé webové regresní testy pouze při změně webu.
- `Windows host compile`: jen při změně Windows hostitele nebo workflow.
  Nejde o sestavení instalátoru ani o publikování aktualizace.
- Čistě dokumentační PR nemusí spouštět žádný build.
- Změna GitHub workflow nebo společné infrastruktury spustí všechny kontroly.
- `concurrency.cancel-in-progress` zruší starší běh **téhož PR**, nikoli jiné PR.

Názvy kontrol `bridge` a `web` zůstávají stabilní kvůli případným
existujícím pravidlům pro slučování větví. Přesnou konfiguraci required
checks je nutné případně ověřit v GitHub Settings → Branches.

## Kompletní kontrola

Workflow `CI` lze spustit ručně tlačítkem **Run workflow** na GitHub
Actions. Úplná sada běží také v neděli v 03:17 UTC. Zahrnuje bridge,
všechny testy, web i sestavení Windows hostitele.

## Push do main / aktualizace aplikace

Po mergi se znovu nespouští samostatné Linux CI. Pokud změna zasáhla
`apps/windows-host/**`, `apps/bridge/**`, `apps/web/**` nebo release
workflow, spustí se `windows-installer.yml`.

Windows runner sestaví produkční web, self-contained bridge a tray,
provede smoke test zabalené aplikace, ověří offline SimConnect režim a
vytvoří Velopack instalátor. Úspěšný push do main pak publikuje release
pro automatický updater. Release workflow se nespouští při PR.

Manuální spuštění Windows workflow vytvoří instalační artefakt pro
testování, ale **nezveřejní** automatickou aktualizaci.

Vydání se serializují pomocí concurrency bez rušení běžícího vydání, aby
nedošlo k přerušení publikování v půli procesu.

## Cache

- npm: `actions/setup-node` se zámkem `apps/web/package-lock.json`;
  používáme reprodukovatelné `npm ci`.
- NuGet: `actions/cache` sdílená mezi CI a Windows workflow, klíč
  je navázán na projektové soubory a operační systém.

Skutečné zrychlení je nutné vyhodnotit podle doby GitHub Actions
před/po změně. Při změně backendového API se změnou kontraktu webu
musí PR obsahovat i odpovídající webové úpravy.
