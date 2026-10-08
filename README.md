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

## Další vývoj

Etapa B2 přidává skutečné údaje z MSFS 2020 a čeká na ověření
se simulátorem na Windows PC. Dále rozšíříme PFD, mapu,
profily letadel a bezpečné ovládání.
