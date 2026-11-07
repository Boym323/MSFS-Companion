# MSFS Companion: plán migrace na Airbus-first / Airbus-only

Stav plánu: **návrh k revizi, nic není sloučeno ani mazáno**.
Výchozí commit main: `60bfbe3cd7ccd2e00296c177f9cf42ab3aee0c5b` (7. listopadu 2026).
Související otevřený Draft PR: [#144 – FlyByWire A32NX a SimBridge](https://github.com/Boym323/MSFS-Companion/pull/144).

## Cíl a nepřekročitelné podmínky

- Podporovaná cílová letadla: **FlyByWire A32NX** a **iniBuilds A320neo V2** pro MSFS 2020.
- Sdílené funkce zůstávají: SimConnect, aktuální letová telemetrie, PFD, mapa/GPS, SimBrief,
  VATSIM, METAR/TAF, rádio, briefing, letový deník, osobní checklisty, diagnostika,
  Windows tray, lokální síť a bezpečné aktualizace.
- Odstraňované funkce: specializované ovládání G1000, G3000, G3X, GNS430/530,
  specializované profily jiných letadel a **po akceptaci náhrady** experimentální
  Asobo A320neo V1 FCU/MCDU/WASM.
- Obecnou identifikaci neznámého letadla a fail-closed ovládací politiku zachovat:
  neznámé TITLE nezpřístupní speciální akce. Rozpoznání TITLE není ověření balíčku.
- Nevykonávat smazání dat z profilu Windows, localStorage ani MSFS Community.
  Nepřepisovat historii letu a nerušit instalovaný WASM modul automaticky.
- Všechny PR zůstanou oddělené a nesloučené, dokud je vlastník neschválí.
  Neprovádět přímo změny v main a nepouštět automatický release.

## Ověřené technické závislosti

1. `apps/web/src/App.tsx` přímo importuje G1000, AdvancedAvionics,
   AircraftCapabilities a A320Dashboard; `navigation/navigation.ts` definuje jejich URL.
2. `apps/web/src/workspace/CockpitWorkspace.tsx` přímo používá G1000Remote,
   AdvancedAvionics a A320CompactStatus. `workspace/layout.ts` povoluje stará ID;
   `workspace/aircraftPresets.ts` obsahuje presety C172, TBM a XCub.
   Uživatelské layouty v localStorage nesmějí vyvolat pád po odstranění panelů.
3. `apps/bridge/Avionics/G1000Service.cs` slouží zároveň G1000 i AdvancedAvionics.
   `CapabilityEndpoints.cs` přes ni volá oba read-only statusy.
   Smazání jednotlivých souborů bez úpravy těchto závislostí neprojde.
4. `AircraftProfileResolver.cs` musí zachovat pravidla pro A32NX/iniBuilds,
   fallback a `IsAirbusLike`, který je důležitý pro blokování neověřených povelů.
5. Asobo V1 je provázáno s `apps/bridge/Airbus/`,
   `SimConnectTelemetrySource.cs`, `apps/a320-wasm/`,
   `apps/windows-host/A320ModuleInstaller.cs`, nastavením tray a
   `.github/workflows/windows-installer.yml`.
   Tento blok nerozebírat, dokud neprojde pilotní akceptace A32NX a V2.

## Plán samostatných pull requestů

### PR-A: Dokumentace a migrace (pouze plán)

**Větev:** `docs/airbus-only-migration-plan` (vychází z main).
Tento dokument, přesný seznam záloh a akceptační kritéria.
Žádné změny běžící aplikace, žádné odstraňování.

### PR-B: Bezpečný úklid odpojeného kódu (nezávislý)

**Větev:** `cleanup/airbus-unused-panels` (vychází z main).
Předpokládané odstranění:
- `apps/web/src/a320/A320FcuControlPanel.tsx`
- `apps/web/src/a320/A320HEventsPanel.tsx`
- kořenový prázdný `package-lock.json` (frontend používá `apps/web/package-lock.json`).

Tyto dva starší panely nejsou importované do aktuálního React runtime.
Před sloučením ověřit všechny testy, dokumentaci a odkazy a případně
aktualizovat testy referencí. Žádné backend příkazy se zde nemění.
Akceptace: `npm ci`, webové testy, `npm run build`, vizuální UI.

### PR-C: Odstavení avioniky ostatních letadel ve webovém UI

**Větev (po schváleném PR-B):** `refactor/airbus-only-web-navigation`.
Odstranit veřejné stránky `/g1000` a `/avionics`,
komponenty `apps/web/src/g1000/`, `apps/web/src/avionics/`,
jejich importy v `App.tsx`, navigaci a workspace.
Upravit uložené předvolby workspace a checklisty: neznámá ID
bezpečně normalizovat na zachované panely (PFD / mapa), **nevymazat localStorage**.
Stránku `/capabilities` zatím ponechat jako diagnostickou, dokud se nevytvoří
Airbus-specifická náhrada a nebude upraven backend.
Akceptace: build, všechny testy webu, historie prohlížeče,
mobil/tablet; staré URL musí vrátit vysvětlující stránku nebo
přesměrování, ne nenápadně jinou funkci.

### PR-D: Odstranění G1000 / G3000 / G3X / GNS na backendu

**Větev (po PR-C):** `refactor/airbus-only-avionics-api`.
Zpřehlednit přímo závislé soubory:
- `apps/bridge/Avionics/G1000Service.cs`, `G1000Catalog.cs`,
  `G1000Endpoints.cs`, `AdvancedAvionicsCatalog.cs`,
  `AdvancedAvionicsEndpoints.cs`;
- `apps/bridge/Integrations/CapabilityCatalog.cs`,
  `CapabilityEndpoints.cs`, `CompatibilityAssessment.cs` jen
  po nahrazení potřebné Airbus diagnostiky;
- registrace v `apps/bridge/Program.cs` a pravidla ostatních
  letadel v `apps/bridge/Aircraft/AircraftProfileResolver.cs`.

Zachovat zásadu fail-closed, read-only letová data a sdílené rádio.
Vytvořit malý Airbus capabilities endpoint **bez neověřených povelů**
nebo ponechat /aircraft/profile, podle skutečných klientů.
Související testy `tests/g1000-logic`, `tests/capabilities`,
`tests/compatibility-lab`, `tests/profiles` a testy API
**upravit**: odstranit jen scénáře skutečně odebrané služby;
zachovat a posílit regresní kontrolu A32NX/V2, změny TITLE a blokace příkazů.
Akceptace: dotnet build, kompletní .NET CI, HTTP smoke test,
ověření 404/410 starých příkazových endpointů, Windows host compile.
Důležité: CI filtry dle změněných cest nesmějí skrýt regresi.

### PR-E: Stabilizace A32NX a nová iniBuilds V2 integrace

**Větev:** samostatné feature PR, podle schválených integračních kontraktů.
Předpoklad: PR #144 je akceptovaný a podporovaný ve vybraném prostředí.
U A32NX používat oficiální SimBridge Remote MCDU; bez domnělých FMS dat.
U V2 realizovat pouze ověřené read-only/command capability.
Na skutečném Windows/MSFS potvrdit TITLE obou variant, stale/reset,
MCDU, aktualizace, iPad/Mac a SimBrief.
**Uživatel následně výslovně schválil přípravu odstranění Asobo V1/WASM i před akceptací nové avioniky.** PR-F se proto připravuje hned, ale žádný merge nebo release neproběhne bez kompletních testů a zvláštního souhlasu. FlyByWire/iniBuilds funkce se nepředstírají.

### PR-F: Odstranění původního Asobo A320neo V1 a WASM

**Větev připravena na žádost uživatele:** `remove/asobo-v1-wasm`, Draft PR #152 (stacked na #151).
Potenciální odstranění:
- Asobo-only `apps/web/src/a320/` a cesty `/a320` (pouze části,
  které nové Airbus dashboardy již nenahrazují);
- `apps/bridge/Airbus/`, asobo-specifické části
  `SimConnectTelemetrySource.cs`, registrace A320 služeb v Program.cs;
- `apps/a320-wasm/`, `scripts/package-a320-wasm.py`,
  `apps/windows-host/A320ModuleInstaller.cs`, tray menu a
  `A320ModuleAutoUpdates` v nastavení;
- balení MSFS SDK, WASM a související instalační smoke testy
  ve Windows workflow.

**Nepokoušet se automaticky odinstalovat** již instalovaný
`Community/kokpit-asobo-a320-v1`. Uživatel dostane zvláštní,
ověřený postup odstranění pouze tohoto spravovaného balíčku.
Před odstraněním nastavení implementovat migraci starých settings.json.
Regrese: žádný Airbus V1 H-event/AP povel pro FBW/V2,
funkční společné navigační/letové údaje, instalátor a update.

### PR-G: Optimalizace frontendu a release

**Větev:** `perf/airbus-only-lazy-dashboard` (nezávislá na mazání,
ale měřit před i po).
Zavést lazy-loading stránek, izolovat 20Hz telemetrii od
statických panelů, snížit nevynucené periodické dotazy,
ponechat mapové vrstvy na vyžádání.
Zmíněné API a datové cache nesmějí předstírat aktuální data.
Baseline: velikost JS/CSS/gzip, počet rerenderů za 60 s,
CPU/RSS bridge i tray, P50/P95 zpoždění, stabilita při 15 minutách letu.
U vydání měřit velikost Setup.exe a *.nupkg proti v0.2.193
(Setup cca 144,9 MB). Úsporu před měřením neslibovat.

### PR-H: Recovery watchdog – samostatné rozhodnutí

**Větev připravena na výslovnou žádost uživatele:** `remove/recovery-watchdog`, Draft PR #153 (stacked na #152).
Watchdog je dnes opt-in a standardně vypnutý, ale balí se do instalátoru.
**Neodstraňovat současně** s ostatní avionikou.
Nejprve porovnat instalaci, aktualizaci a scénáře výpadku
s vypnutým i zapnutým watchdogem na testovacím Windows účtu/VM.
Rozhodnuto odstranit jen neověřený automatický recovery supervisor. Zachovat journal, integritně ověřený balíček a ručně potvrzenou obnovu předchozího vydání; nelikvidovat soukromá data.

### PR-I: Sjednocení dokumentace a regresních testů

Až na konci upravit README, docs/ARCHITECTURE.md,
docs/PROJECT_STATUS.md, AGENTS.md jen pokud se změní pravidla.
Historickou Asobo/Garmin dokumentaci archivovat odděleně,
neodstraňovat bez dohledatelné migrace v Git historii.
Zachovat testy kritické pro identitu, bezpečnost, LAN, aktualizace,
SimConnect, letový deník a data. CI výsledek musí popisovat realitu.

## Zálohy před kterýmkoliv vydáním s odstraněním funkcí

1. Zdrojový checkpoint: zapsat SHA aktuálního main a vytvořit
   před migrací git tag až při schválené implementaci; historický
   release v0.2.193 odpovídá uvedenému SHA. Nikdy nepřepisovat tagy.
2. **Zastavit Companion a MSFS** před kopírováním aktivních souborů.
   Uchovat oddělenou lokální kopii celé
   `%LOCALAPPDATA%\MSFS Companion\`, především
   `settings.json`, `flights\`, případné journal soubory.
   Zálohy letů obsahují soukromé GPS trasy: nepublikovat na GitHubu.
3. Zaznamenat verzi instalátoru a ponechat ověřený Setup.exe /
   Velopack balíček pro případ návratu.
4. V prohlížeči iPadu/Macu exportovat ne-citlivé preferences:
   `msfs-companion-workspace-v1`,
   `msfs-companion-aircraft-layout-v1:*`,
   `msfs-companion-checklist-v1:*`,
   `kokpit-workspace-layout-lock-v1`.
   **Neexportovat** párovací tokeny, cookies ani celé sessionStorage.
5. MSFS Community balíček `kokpit-asobo-a320-v1` nikdy
   nemazat bez kontroly vlastnictví a výslovného pokynu.
6. Ověřit obnovu na **oddělené testovací instalaci**:
   kopie flights se načte, settings se převedou,
   staré widgety z uloženého layoutu bezpečně odpadnou a
   zbytek funkcí pokračuje bez ztráty dat.

## Základní testovací matice pro každý PR

- **Statika:** žádné neexistující importy, překlepy route,
  endpointy nebo odkazy na odstraněné příkazy.
- **Frontend:** `npm ci --prefix apps/web`,
  existující Node testy (`node --test ...` dle CI),
  `npm run build --prefix apps/web`, Chromium vizuální audit:
  320/375/390/768/1024/1280/1440 px.
- **Backend:** `dotnet build apps/bridge/MsfsCompanion.Bridge.csproj -c Release`,
  plná kompatibilní .NET suite a HTTP/WebSocket smoke.
- **Windows:** sestavit tray i instalační Velopack balíček,
  smoke instalace a bezproblémové aktualizace.
- **Bezpečnost:** falešný TITLE, změna A32NX -> V2 -> jiné letadlo,
  offline/stale, zákaz neověřených příkazů, stejný Origin,
  LAN Host policy a žádný internetový port.
- **Živý test:** A32NX + SimBridge, iniBuilds V2, iPad/Mac,
  SimBrief, FCU/MCDU jen dle dostupného kontraktu,
  15 minut bez ztráty dat nebo destabilizace SimConnect.
- **Výsledek:** PASS/FAIL/INCONCLUSIVE s důkazem.
  Zelené CI bez MSFS **není** potvrzením kompatibility avioniky.

## Pravidla slučování a návratu

- Žádné hromadné mazání nebo více rizikových kategorií v jednom PR.
- Každý PR má diff, přehled změněných endpointů, testy, rollback
  a vlastní sign-off. Schvalování je **samostatné**.
- Závislé PR vytvářet až po schválení předchůdce;
  neotvírat souběžně destruktivní práce do stále pohyblivého main.
- Po prvním neúspěšném akceptačním testu zastavit další mazání,
  vrátit předešlý ověřený release, nezasahovat do soukromých dat.

## Implementační PR připravené k revizi (7. 11. 2026)

- [#144](https://github.com/Boym323/MSFS-Companion/pull/144) – oficiální FlyByWire A32NX/SimBridge, Draft, nutná živá akceptace.
- [#146](https://github.com/Boym323/MSFS-Companion/pull/146) – bezpečný úklid odpojených A320 UI panelů, Draft; webové CI prošlo.
- [#147](https://github.com/Boym323/MSFS-Companion/pull/147) – samostatná oprava runneru pro Chromium/Playwright, Draft; CI a vizuální audit prošly.
- [#148](https://github.com/Boym323/MSFS-Companion/pull/148) – odstranění Garmin obrazovek a migrace starého workspace při zachování localStorage, Draft.
- [#149](https://github.com/Boym323/MSFS-Companion/pull/149) – odstranění Garmin Input Events a příkazových API, Draft **navazuje na #148**; po opravě HTTP smoke CI prošlo.
- [#150](https://github.com/Boym323/MSFS-Companion/pull/150) – ruční neinvazivní záloha nastavení/letů v PowerShellu, Draft; Windows test syntetických dat prošel.
- [#151](https://github.com/Boym323/MSFS-Companion/pull/151) – React lazy-loading + zastavení polling updateru v zavřeném panelu, Draft **navazuje na #149**; Vite měření počátečního JS gzip před 148,46 kB, po prvním výkonovém commitu 76,24 kB (při fixních závislostech).

**Povolené pořadí:** samostatně schválit #147 a #150, následně #146 a #144; po kontrole konfliktů a pilotní akceptaci #148 → #149 → #151. Nejprve zajistit bezpečnou zálohu uživatelských dat. Přesné pořadí může vyžadovat rebase větví – nikdy neslučovat automaticky. PR #152 a #153 už vyřazují Asobo V1/WASM a automatický watchdog na větvích bez zásahu do main. Nezávislý manuální recovery journal a ověřený balíček zůstávají. Žádná produkce bez zálohy, testů a souhlasu.

Vizuální CI PR #146/#148/#149/#151 nyní může selhávat kvůli Ubuntu runneru v main; nelze jej zaměňovat za chybu aplikačního kódu. Před slučováním vyžadovat zelený vizuální audit po opravě #147.

- [#152](https://github.com/Boym323/MSFS-Companion/pull/152) – odstranění Asobo A320neo V1 FCU/MCDU a nefunkčního WASM z webu/bridge/Windows balení; pouze Draft, bez automatického zásahu do Community.
- [#153](https://github.com/Boym323/MSFS-Companion/pull/153) – odstranění experimentálního recovery watchdog procesu a opt-in přepínače; zachována ručně potvrzená obnova, SHA-256 cache a update journal; pouze Draft, stacked na #152.

## Integrované vydání

Připravená větev `integration/airbus-only-main` konsoliduje obsah PR #144–153, jejich kompatibilní části a testy do jediné produkčně ověřitelné verze. Původní staré PR se po dokončení označí jako zahrnuté bez nezávislého mezivydání. Provoz v MSFS musí být otestován samostatně, FMS iniBuilds V2 nepředstíráme jako ověřenou integraci.
