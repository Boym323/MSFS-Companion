# MSFS Companion

Webový doplněk pro **Microsoft Flight Simulator 2020**.
Windows aplikace běží na pozadí, automaticky se aktualizuje,
čte letová data přes SimConnect a poskytuje dashboard v domácí síti.

> **B2 vývojová verze:** Windows instalace používá živá data ze
> SimConnect. Pokud MSFS není připojený, zobrazuje čekání, nikoli
> vymyšlené údaje. Samostatné spuštění na Macu používá mock data.

## Spuštění při vývoji

Požadavky: .NET 10 SDK, Node.js 22.12+ a Git.

V kořeni projektu spusťte backend:

```bash
dotnet run --project apps/bridge
```

V dalším terminálu spusťte web:

```bash
cd apps/web
npm install
npm run dev
```

Otevřete `http://127.0.0.1:5173/admin`.

Testy při spuštěném backendu:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## Živá telemetrie B2

Po instalaci na Windows se bridge pokusí připojit k MSFS 2020
bez ručního nastavování. Dashboard rozlišuje **SIMCONNECT LIVE**,
**ČEKÁM NA MSFS** a vývojový **MOCK MODE**. Stav připojení,
frekvence a stáří vzorku jsou na stránce `/admin`.

Podrobnosti a postup prvního ověření:
[Živá telemetrie B2](docs/LIVE_SIMCONNECT_B2.md).

## mDNS adresa v domácí síti

Windows aplikace může na místní síti inzerovat volitelnou adresu `kokpit.local`.
Ve Windows tray lze mDNS vypnout nebo změnit krátký název hostitele, například
na `simdeck` → `simdeck.local`. Název aplikace a aktualizační mechanismus
zůstávají **MSFS Companion**. Alternativou je původní adresa podle IP.
Podrobnosti: [mDNS nastavení](docs/MDNS_C12.md).

## Windows a domácí síť

Nainstalujte poslední `Setup.exe` z
[GitHub Releases](https://github.com/Boym323/MSFS-Companion/releases).

Windows hostitel automaticky spouští bridge, zobrazuje ikonu u hodin
a po startu a každou hodinu kontroluje aktualizace.

V nabídce u hodin vyberte
**Zkopírovat adresu dashboardu v LAN**. Na Macu nebo tabletu
ve stejné domácí podsíti otevřete uvedenou adresu, například
`http://192.168.1.25:8765/admin`.

V panelu **Správa Windows aplikace** je tlačítko pro vynucenou
kontrolu a instalaci nové verze. **Bez Tailscale, bez klíče
a bez přihlášení.** Aktualizuje se jen Companion; MSFS
zůstává spuštěný.

Ve Windows může být nutné jednorázově povolit TCP 8765
pro profil Private a LocalSubnet. Nepovolujte veřejný přístup
a port nepřesměrovávejte na internet.

**Důležité:** Každé zařízení ve stejné důvěryhodné podsíti
smí vyvolat aktualizaci. Cross-site požadavky a přístup
z jiných podsítí server odmítá; nejde o autentizaci uživatele.

B2.3 odděluje příjem SimConnect (při 30 FPS přibližně 30 Hz)
od publikování unikátních dat (cílově 20 Hz). Dashboard ukazuje
obě frekvence, zpoždění a přeskočené snímky.
Podrobnosti jsou v [českém průvodci telemetrií B2](docs/LIVE_SIMCONNECT_B2.md).

Podrobný [český návod k Windows a domácí síti](docs/WINDOWS_INSTALLER.md).
Dále [architektura](docs/ARCHITECTURE.md),
[diagnostika SimConnect](docs/SIMCONNECT_PROBE.md)
a [aktualizace](docs/UPDATES.md).

## Projekt

```text
apps/bridge/          HTTP API, WebSocket, telemetrie a řízení aktualizací
apps/probe/           Diagnostika SimConnect B1 na Windows
apps/web/             React/TypeScript dashboard
apps/windows-host/    Windows tray, automatické aktualizace a LAN konfigurace
docs/                 Česká dokumentace
tests/                Regresní testy
.github/              CI a publikování
```

## Primární letový displej B3

Na stránce `/pfd` je připravený umělý horizont, rychlostní a výšková
páska, vertikální rychlost a magnetický kurz. PFD používá skutečná data
z MSFS 2020 a plynule vyhlazuje **pouze zobrazení**, zatímco telemetrie
zůstává beze změn. Pokud se SimConnect odpojí, přístroj jasně oznámí
neplatná data. Více v [českém návodu k PFD](docs/PFD_B3.md).

## Pohyblivá mapa B4

Na stránce `/map` se zobrazuje GPS poloha, magnetický kurz a
proletěná stopa (omezená na 3600 bodů, přibližně hodina při 1 Hz).
Souřadnicová mapa funguje bez internetu. Podklad
OpenStreetMap se zapíná automaticky a lze jej vypnout:
poskytovatel dlaždic může odhadnout zobrazenou oblast.
[Český návod k mapě](docs/MOVING_MAP_B4.md).

## Integrovaná letecká mapa C8 V2

Vrstvy letišť, drah, VOR/NDB/DME a detail letiště s frekvencemi jsou
přímo součástí Companion. Windows bridge stáhne otevřená data z
[OurAirports](https://ourairports.com/data/) po HTTPS, obnovuje je nejvýše
jednou za 24 hodin a ukládá komprimovanou cache pro offline použití.
Na iPad se přenáší pouze omezené okolí aktuální polohy.
**Little Navmap ani jiný externí software už nejsou potřeba.**
Viz [dokumentace C8](docs/AVIATION_MAP_C8.md).

## Záznam a přehrávání letů B5

Samostatná stránka `/flights` nabízí výpis uložených letů,
graf výšky a rychlosti, GPS stopu na automaticky zobrazeném
podkladu OpenStreetMap a přehrávání.
Windows bridge zaznamenává přibližně jeden vzorek za sekundu
**nezávisle na otevřeném dashboardu**, nejvýše 30 letů / 100 MB
v profilu uživatele. Při přepnutí na mock se testovací záznam
výslovně označí. Historie obsahuje polohy a je dostupná
v rámci důvěryhodné domácí sítě. Viz
[český návod k Flight Recorderu](docs/FLIGHT_RECORDER_B5.md).

## Rozšířené systémové údaje B6

Vedle rychlého PFD odběru existuje **samostatná 1Hz read-only
SimConnect subscription** pro Ground Speed, TAS, výšku AGL,
vítr, autopilota, klapky, podvozek, motor a palivo.
`GET /api/aircraft/systems` vrací stav a aktuální údaje
nebo `null`, pokud nejsou dostupné. Autopilota ani jiné
systémy není možné tímto API ovládat. Viz
[česká dokumentace rozšířené telemetrie](docs/SYSTEMS_B6.md).

## Detail letadla B7

Na stránce `/aircraft` je sjednocený read-only přehled
rychlostí, výšek, systému autopilota, podvozku, klapek,
motoru, paliva, větru a GPS. Používá stávající rychlou
telemetrii a nové 1Hz systémové API B6, nezakládá další
SimConnect spojení. Během výpadku nic nevydává za živé.
XCub, Cessna a Airbus mají zatím pouze bezpečné univerzální
štítky; speciální instrumentace jednotlivých letadel přijde
až po reálném ověření SimVars.
[Český návod k detailu letadla](docs/AIRCRAFT_B7.md).

## Diagnostika kompatibility B8

Stránka `/aircraft` nyní zobrazuje také kontrolu kvality přijatých
SimVars a umožňuje stáhnout diagnostický JSON bez GPS polohy.
Číselně platný údaj ještě nepotvrzuje kompatibilitu s konkrétním
kokpitem. Viz [postup ověření pro XCub Floats / C172 / A320](docs/AIRCRAFT_B8.md).

## Uživatelské rozhraní B9

Společné navigační popisky, kompaktnější hlavička, zvýraznění aktivní
stránky a sbalitelná technická diagnostika přenosu. Dashboard zůstává
přístupný z tabletu i z Macu ve stejné důvěryhodné LAN.
Viz [dokumentace B9](docs/UI_B9.md).

## Letová analytika B10

Historie letů zobrazí odhad stoupání, klesání, ustáleného letu
a přiblížení. Nové záznamy volitelně zahrnují AGL a stav na zemi,
pokud jsou SimVars čerstvé. Vzlet a kontakt se zemí se hlásí
**jen při dvojitém potvrzení změny onGround**, u starých záznamů
nikoli. Viz [omezení a ověření B10](docs/FLIGHT_INTELLIGENCE_B10.md).

## Vydání a bezpečnost

Windows build lze volitelně podepisovat po doplnění infrastruktury
certifikátů, ale dokud není `WINDOWS_SIGN_PARAMS` nakonfigurován,
zůstávají instalátory nepodepsaná vývojová vydání. Základní
manuální obnova předchozí verze používá SHA-256 ověřený plný balíček.
Samostatný watchdog je přibalený jako **experimentální opt-in funkce,
standardně vypnutá**. Automatický návrat zatím nebyl prokázán
záměrně poškozenou aktualizací dvou nainstalovaných Windows verzí.
Viz [příprava podepisování a obnova](docs/RELEASE_HARDENING.md).


## Ovládání kokpitu C1/C2 a G1000 C3

Na `/controls` fungují COM/NAV, transpondér a autopilot. V rámci důvěryhodné
domácí LAN je **párování standardně vypnuté**. Na Windows lze na
`http://127.0.0.1:8765/controls` zapnout párování (3min kód, 8h relace).
Příkazy mají allowlist, kontrolu hodnot a vyžadují živý MSFS. Nikdy
neotevírejte lokální HTTP server do internetu.

Na `/g1000` jsou připraveny FMS/HDG/NAV a kandidátní Direct-To/Menu/CLR
ovladače. Dostupnost Input Events se zjišťuje u aktuálního letadla:
nepodporované ovladače se deaktivují. MSFS 2020 avionika vyžaduje manuální
ověření. Viz [dokumentace C1/C2](docs/COCKPIT_CONTROLS_C1_C2.md) a
[G1000 C3](docs/G1000_C3.md).

## GPS navigace a flight plan C4

Mapa `/map` zobrazuje dostupný aktuální waypoint, aktivní GPS úsek,
vzdálenost, trať a základní stav flight planu. Volitelně lze vybrat
soubor `.PLN` a prohlížet úplnou **ručně importovanou** trasu; nejde o
automaticky synchronizovaný flight plan z avioniky.
Viz [GPS navigace C4](docs/NAVIGATION_C4.md).

## Další vývoj

Etapy B2–B7 tvoří základ reálné telemetrie, PFD, mapy,
historie letu a read-only systémového panelu. Další vývoj
se zaměří na test kompatibility letadel, specializované
avionické profily a volitelná zabezpečená ovládací API.

## Profily letadel C5

Nové read-only `/api/aircraft/profile` a panel `/aircraft` rozpoznávají
kandidátní avioniku podle `TITLE`. Nejisté varianty zůstávají označené
jako neověřené; profil sám o sobě nepovoluje G1000 ani jiné příkazy.
Viz [C5 – profily letadel](docs/AIRCRAFT_C5.md).

## Vlastní kokpit C11

Na `/workspace` lze sestavit až tři panely (PFD, mapa, letadlo,
COM/NAV, G1000 nebo další avionika), vybrat jeden či dva sloupce a
přesouvat jejich pořadí. Rozložení se ukládá pouze v prohlížeči.
Viz [C11 – vlastní displeje](docs/WORKSPACE_C11.md).

## Nové etapy C41–C50 – stav implementace

- **C41:** Na `/validation` lze porovnat read-only SimVars/GPS před a po změně v MSFS.
  Ruční potvrzení avioniky je stále nutné. [Dokumentace](docs/VALIDATION_C41.md).
- **C42:** Částečně hotovo – update journal zná předchozí instalovanou a
  poslední úspěšně ověřenou verzi. **Nezávislý watchdog je implementovaný jako experimentální opt-in
  funkce, standardně vypnutý; skutečný crash/downgrade test dvou
  Windows vydání ještě neproběhl.** [Dokumentace](docs/UPDATE_C42_RECOVERY_PROVENANCE.md).
- **C43:** Na `/g1000` lze ručně potvrzovat/hlásit odchylky jednotlivých
  enumerovaných Input Events pro přesné letadlo. [Dokumentace](docs/AVIONICS_C43.md).
- **C44:** Na `/map` se shoda GPS × PLN/SimBrief odvozuje z polohy a
  identifikátoru odděleně. Žádná automatická synchronizace do FMS.
  [Dokumentace](docs/FLIGHT_PLAN_C44.md).
- **C45:** OpenAir mapa podporuje oblouky `DA`/`DB`, kružnice `DC`,
  reálné anotace souborů Aeroklubu a automatický výběr posledního
  účinného katalogového souboru. **Živá aktivace a NOTAM nejsou ověřené**.
  [Dokumentace](docs/AIRSPACE_C45.md).
- **C46:** Volitelná SimConnect traffic vrstva ukazuje relativní vzdálenost,
  směr a výškový rozdíl; **nejde o TCAS**. [Dokumentace](docs/TRAFFIC_C46.md).
- **C47:** Letištní briefing ukazuje složky větru z čerstvého METAR podle
  geometrie drah. [Dokumentace](docs/RUNWAY_WIND_C47.md).
- **C48:** `/progress` nabízí orientační TOD pro aktuální GPS leg, nikoliv
  VNAV autopilota. [Dokumentace](docs/DESCENT_C48.md).
- **C49:** `/flights` umí exportovat hromadnou GPS zálohu JSON a lokálně
  zkontrolovat její formát; **lokální obnova do recorderu je dostupná na Windows loopbacku**;
  data se importují pod novými ID a aktivní nahrávání blokuje import.
  [Dokumentace](docs/LOGBOOK_C49.md).
- **C50:** `/workspace` ukládá uživatelsky vyvolané presety jednotlivých
  letadel, bez automatického přepínání panelů.
  [Dokumentace](docs/WORKSPACE_C50.md).

Automatické CI není náhradou za test s reálným MSFS 2020.
Aktuální otevřené validační úkoly jsou [issue #19](https://github.com/Boym323/MSFS-Companion/issues/19),
[#20](https://github.com/Boym323/MSFS-Companion/issues/20),
[#23](https://github.com/Boym323/MSFS-Companion/issues/23)
a [#24](https://github.com/Boym323/MSFS-Companion/issues/24).


## Stabilizace a akceptační testy

Po auditních opravách C42/C49 přibyl
[akceptační protokol](docs/STABILIZATION_ACCEPTANCE.md) pro skutečné
Windows rollback zkoušky, SimConnect letadla, GPS avioniku a archivaci.
GitHub CI potvrzuje sestavení a simulované regresní scénáře, **ne však
reálný let nebo destruktivní výpadek dvou nainstalovaných verzí**.
Závislosti nyní kontroluje také
[týdenní bezpečnostní audit](docs/DEPENDENCY_SECURITY.md).

## Asobo A320neo (MSFS 2020)

Samostatná stránka `/a320` a volitelný panel
`/workspace` zobrazují 1Hz **read-only** FCU/ENG/APU/fuel
diagnostiku, vedle dosavadní 20Hz PFD a mapy. Identita
`TITLE` je průběžně kontrolována a měření mimo správné
letadlo, při výpadku nebo po 6 sekundách stáří se skryjí.
Generické `autopilot.*` povely jsou u Airbusu
z bezpečnostních důvodů vypnuté.

Automatické testy zkoušejí data a bezpečnostní pravidla,
nikoliv skutečný účinek FCU na Asobo A320neo.
Pilotní akceptační postup:
[Asobo A320](docs/ACCEPTANCE_A320.md),
[identita](docs/A320_01_IDENTITY.md),
[FCU a motory](docs/A320_02_03_READBACK.md),
[dashboard](docs/A320_04_DASHBOARD.md).
