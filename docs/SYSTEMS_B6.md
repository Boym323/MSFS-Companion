# B6 – rozšířené systémové údaje MSFS 2020

## Princip

Základní telemetrie PFD běží nadále samostatně:
SimConnect SimFrame vstup a maximálně 20 unikátních vzorků
za sekundu na výstupu. **B6 tento hot path nemění.**

B6 přidává druhou, **1Hz** subscription
`SimConnectPeriod.Second`, která pouze čte systémové
proměnné. Rozhraní prohlížeče se připojuje jen na existující
HTTP server Companionu, nevytváří další SimConnect klienty.

## Proměnné

| Zobrazení | SimConnect SimVar | Jednotka |
|---|---|---|
| True Airspeed | AIRSPEED TRUE | knots |
| Ground Speed | GROUND VELOCITY | knots |
| Výška nad terénem | PLANE ALT ABOVE GROUND | feet |
| Směr větru | AMBIENT WIND DIRECTION | degrees |
| Rychlost větru | AMBIENT WIND VELOCITY | knots |
| Na zemi | SIM ON GROUND | bool |
| Klapky | FLAPS HANDLE PERCENT | percent |
| Podvozek | GEAR HANDLE POSITION | bool |
| Autopilot | AUTOPILOT MASTER | bool |
| Zvolený kurz | AUTOPILOT HEADING LOCK DIR | degrees |
| Zvolená výška | AUTOPILOT ALTITUDE LOCK VAR | feet |
| Zvolená VS | AUTOPILOT VERTICAL HOLD VAR | feet per minute |
| Otáčky prvního motoru | GENERAL ENG RPM:1 | rpm |
| Celkové palivo | FUEL TOTAL QUANTITY | gallons |

Jde o obecné SimVars. V závislosti na typu letadla se
některé veličiny nemusí zobrazovat, mohou být nulové nebo
nemusí odpovídat specializovanému kokpitu třetí strany.
**Nepovažujte je za certifikovaná měření.**

## HTTP API

`GET /api/aircraft/systems`

Příklad úspěšné odpovědi obsahuje `connected: true`,
`lastUpdatedUtc`, `sampleAgeMs` a `systems` s hodnotami.
Při vypnutém MSFS nebo pokud nepřicházejí platné systémové
vzorky po dobu alespoň deseti sekund vrací
`connected: false, systems: null`.

Endpoint je **pouze pro čtení**. Není implementováno
žádné nastavování AP, klapek, podvozku ani dalších prvků.
Při selhání sekundární subscription pokračuje PFD.

Testovací režim `mock` obsahuje explicitní `mode: mock`,
nikdy se nesmí vydávat za skutečný let.

## Ověření

1. Na Windows spusťte MSFS 2020 a načtěte let.
2. Otevřete `/api/aircraft/systems` z Macu na LAN IP
   Windows PC.
3. Ověřte `connected: true` a frekvenci přibližně 1 Hz.
4. Změňte klapky/autopilot ve hře a porovnejte stav.
5. Vypněte MSFS; endpoint musí během několika sekund
   přejít do nedostupného stavu.
6. Současně sledujte `/pfd`: rychlý odběr 20 Hz nesmí
   být systémovou telemetrií omezený.

Přesnou kompatibilitu těchto SimVars je nutné ještě
potvrdit v reálných kokpitech (např. XCub Floats, C172).
