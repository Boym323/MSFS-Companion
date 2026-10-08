# Architektura MSFS Companion

MSFS Companion tvoří místní bridge ASP.NET Core, React dashboard,
Windows hostitel na pozadí a samostatná diagnostika SimConnect B1.

## Datový tok

```text
MockTelemetrySource -> TelemetryStore -> HTTP /api/telemetry
                                      -> HTTP /api/status
                                      -> WebSocket /ws -> React dashboard
```

Instalovaný Windows bridge používá `SimConnectTelemetrySource`
pro skutečná data MSFS 2020. Samostatně spuštěný bridge
používá `MockTelemetrySource` pro vývoj.

## Živá SimConnect telemetrie

Windows zdroj používá jednu strukturovanou SimConnect subscription
pro 8 veličin, publikuje nejvýše 20 Hz a automaticky obnovuje
připojení. Poslední vzorek a odhad publikované frekvence jsou
k dispozici v `GET /api/status`. Bez aktuálních dat web
nepředstírá připojení.

Více informací: [B2 – živá telemetrie](LIVE_SIMCONNECT_B2.md).

## Síťový režim

- Při samostatném spuštění bridge naslouchá pouze `127.0.0.1:8765`.
- Windows hostitel navíc vybere konkrétní privátní IPv4 adresu
  aktivního Wi-Fi/Ethernet adaptéru a na ní otevře TCP 8765.
- Požadavky jsou přijímány pouze z loopbacku nebo stejné IPv4
  podsítě; nečekané Host hlavičky jsou odmítány.
- Windows Firewall musí případně povolit příchozí komunikaci
  **jen z LocalSubnet a pro síťový profil Private**.
- Není potřeba Tailscale ani správcovský klíč.
- Port se nesmí zveřejnit na internet.

## API

- `GET /api/status` – režim zdroje dat.
- `GET /api/telemetry` – poslední snímek telemetrie.
- `WS /ws` – telemetrie v JSON přibližně 20× za sekundu.
- `GET /api/admin/updates/status` – stav aktualizací Windows.
- `POST /api/admin/updates/check` – vynucená kontrola a případná instalace novější verze.

Poslední dvě API existují **pouze v bridge spuštěném Windows
hostitelem**, ne v samostatném vývojovém procesu.

## Ochrana aktualizačních požadavků

Systém nemá uživatelská přihlašovací práva. Každé zařízení v
důvěryhodné podsíti může vyžádat kontrolu aktualizací.

Pro zmírnění požadavků z cizích webů POST navíc vyžaduje
odpovídající `Origin` a hlavičku
`X-MSFS-Companion-Action: check-update`; server nepovoluje CORS.
Přísná kontrola Host omezuje DNS rebinding. Přijatý požadavek
vytvoří pouze souborový signál pro lokální Windows hostitel,
nikdy libovolný příkaz shellu.

V době aktualizace se restartuje jen Companion/bridge, ne MSFS.

## Další etapy

- Skutečná telemetrie ze SimConnect a profily letadel.
- PFD a pohyblivá mapa.
- Podepisování vydání a bezpečný rollback.
- Před případným použitím mimo důvěryhodnou LAN je nutná
  plnohodnotná autentizace a HTTPS.


## Záznam letů B5

`FlightRecorder` je hostovaná služba v bridge, ne součást webového
prohlížeče. Čte již dostupné snímky z `TelemetryStore` nejvýše
jednou za sekundu. Každá relace má vlastní JSONL soubor dat a
atomicky zapisovaná metadata. Nezasahuje do simulátoru.

Historie je pouze pro čtení přes `GET /api/flights` a
`GET /api/flights/{id}`. Názvy souborů jsou kontrolovány
přísnou validací identifikátorů. Data se ukládají do profilu
aktuálního Windows uživatele, nejvýše 30 relací / 100 MB,
6 hodin v jedné relaci. Při čtení pro web se počet vrácených
bodů omezuje na 4000. Viz [B5 – Flight Recorder](FLIGHT_RECORDER_B5.md).


## Rozšířená telemetrie B6

Vedle rychlé 30Hz SimFrame subscription pro PFD se čte
oddělená 1Hz skupina systémových SimVars.
`AircraftSystemsStore` zveřejňuje aktuální snapshot pouze
pro čtení přes `GET /api/aircraft/systems`. Při zastaralém
nebo nedostupném zdroji se vrací `connected=false` a
`systems=null`. Selhání systémového odběru nesmí zablokovat
základní telemetrii ani záznam letů. Podrobnosti:
[Systémová telemetrie B6](SYSTEMS_B6.md).
