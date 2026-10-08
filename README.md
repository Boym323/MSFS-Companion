# MSFS Companion

Webový doplněk pro **Microsoft Flight Simulator 2020**. Na počítači s Windows
běží aplikace na pozadí a poskytuje dashboard s letovými údaji.

> **Aktuální stav:** Web a běžný bridge zatím používají simulovanou telemetrii.
> Samostatný diagnostický nástroj B1 již ověřil spojení se skutečným SimConnect.
> Připojení ostré telemetrie do bridge je další etapa B2.

## Požadavky pro vývoj

- .NET 10 SDK
- Node.js 22.12+ (doporučeno Node.js 24)
- Git

Vývojový mock režim funguje na macOS, Linuxu i Windows.

## Spuštění při vývoji

V kořeni repozitáře otevřete dva terminály. V prvním spusťte backend:

```bash
dotnet run --project apps/bridge
```

Ve druhém spusťte web:

```bash
cd apps/web
npm install
npm run dev
```

Otevřete `http://127.0.0.1:5173/admin`. Vite předává požadavky
`/api` a `/ws` lokálnímu bridge.

Backend ověříte těmito příkazy:

```bash
curl http://127.0.0.1:8765/api/status
curl http://127.0.0.1:8765/api/telemetry
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Testy kontrolují HTTP, WebSocket, změny telemetrie a nepřístupnost
neautorizovaných ovládacích příkazů.

## Windows instalace a aktualizace

Vývojové instalační balíčky se automaticky vydávají v
[GitHub Releases](https://github.com/Boym323/MSFS-Companion/releases).
Nainstalujte variantu `Setup.exe`, nikoli přenosný ZIP.

Windows aplikace se spouští po přihlášení, běží u hodin, hlídá svůj
bridge a automaticky kontroluje aktualizace. Nová verze může krátce
restartovat **pouze MSFS Companion**, i když MSFS 2020 právě běží.

V dashboardu na `/admin` je zabezpečená **Správa Windows aplikace**
pro ruční vyžádání kontroly a instalace aktualizací. Klíč se jednou
zkopíruje z nabídky u hodin. Pro ovládání z Macu doporučujeme
soukromé propojení přes Tailscale Serve. **Zpřístupnění bez tunelu
přes veřejný internet není podporováno.**

Podrobný [návod na Windows instalaci a vzdálené aktualizace](docs/WINDOWS_INSTALLER.md).
Doplňující informace: [architektura](docs/ARCHITECTURE.md),
[diagnostika SimConnect](docs/SIMCONNECT_PROBE.md),
[aktualizační mechanismus](docs/UPDATES.md).

## Struktura repozitáře

```text
apps/
  bridge/        ASP.NET Core, lokální API, WebSocket a správa aktualizací
  probe/         Diagnostika SimConnect pro Windows
  web/           React, TypeScript a Vite
  windows-host/  Windows tray, instalátor a automatické aktualizace
tests/           Regresní testy bridge
docs/            Česká technická a uživatelská dokumentace
.github/         GitHub Actions a publikační workflow
```

## Bezpečnost

Bridge poslouchá jen na `127.0.0.1:8765`. Správcovská aktualizační
API se registrují jen pod Windows hostitelem a vyžadují náhodný
správcovský klíč. **Neotevírejte port 8765 do internetu.**
Rozhraní pro přímé ovládání kokpitu zatím neexistuje.

## Plánované etapy

1. Základní bridge a mock telemetrie – hotovo.
2. Diagnostika SimConnect B1 – hotovo.
3. Windows hostitel a aktualizace – vývojová verze; probíhá ověřování.
4. Skutečná telemetrie B2, párování zařízení a bezpečný přenos.
5. PFD, pohyblivá mapa, ovládání autopilota a profilů letadel.
