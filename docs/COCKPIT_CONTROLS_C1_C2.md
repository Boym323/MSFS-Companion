# C1/C2 – kokpitní ovládání MSFS 2020

## Stav a hranice důvěry

- Vlastní API je **vždy při startu vypnuto**. Nikde v LAN nelze ovládání zapnout.
- Pouze uživatel přímo na **Windows PC** otevře `http://127.0.0.1:8765/controls`, zvolí **Povolit**, a zobrazí jednorázový šestimístný kód (3 minuty).
- iPad nebo notebook otevře `http://LAN_IP_PC:8765/controls` a vloží kód. Při úspěchu získá 256bitový token v `sessionStorage`, platný nejvýše osm hodin nebo do restartu.
- API vyžaduje správný Origin, token v hlavičce, povolenou událost, hodnotu v mezích, živá data ze SimConnect, maximálně čtyři příkazy za sekundu.
- Vypnutí na Windows okamžitě zruší všechna párování.
- **Bez TLS:** použití pouze v důvěryhodné domácí síti, nikoliv přes veřejný internet. Tokeny přes HTTP lze na nedůvěryhodné síti odposlechnout.
- C1/C2 pro ovládání používá **samostatný nízkofrekvenční SimConnect handle**. 20Hz PFD stream není změněn.
- HTTP 202 / `sent` znamená odeslání události, **nikoliv provedení**. Stav se potvrzuje až z read-only telemetrie MSFS.
- `/api/controls/local` je výlučně loopback a nikoli veřejné administrativní rozhraní.

## Rozhraní

- `GET /api/controls/status`: enabled/paired/local.
- `GET /api/controls/local`: místní stav a aktuální pairing code, pouze loopback.
- `POST /api/controls/local`: `{"enabled":true|false}` se stejným Origin a `X-MSFS-Companion-Action: control-local`, jen loopback.
- `POST /api/controls/pair`: `{"code":"123456"}` vrací session token. Má limit neúspěšných pokusů.
- `POST /api/controls/command`: `{"command":"radio.com1.set","value":118500000}` s `X-MSFS-Control-Token`.
- `GET /api/radios`: read-only 1Hz frekvence a dostupný stav XPDR.
- `GET /api/autopilot/modes`: read-only 1Hz aktivní HDG/NAV/ALT/VS režimy, nezávislé na systému PFD.

## Ověřované funkce C1

- COM1/2 a NAV1/2 active/standby frekvence a přepínání.
- COM standby Hz a NAV standby Hz přes nativní Key Events.
- XPDR: BCD16 kód, 0000–7777 pouze osmičkové číslice; samostatný readback, pokud jej avionika umožní.

## Ověřované funkce C2

- Zapnutí/vypnutí AP, režimy HDG/NAV/ALT/VS přes explicitní ON/OFF.
- Nastavení headingu, výšky a vertikální rychlosti s numerickou validací.
- Stav AP/HDG/ALT/VS je **převzatý z existující 1Hz systémové telemetrie**.
- Režimy mohou být u avioniky třetích stran odlišné; po odeslání se nesmí automaticky zobrazovat `confirmed`.

## Testovací scénáře

1. Spusťte CI mock: endpointy command nepovolí bez párování nebo v mock režimu.
2. Otevřete /controls z Windows (loopback), zapněte a opište párovací kód na iPad.
3. S MSFS 2020 a XCub nebo C172 na zemi měňte COM standby, NAV standby, XPDR a přepínejte frekvence.
4. Porovnejte hodnoty webu s letadlem a případné chybějící SimVars zaznamenejte.
5. Vyzkoušejte jednotlivé AP režimy pouze v bezpečném testovacím letu, nejdříve zapnout, pak vypnout.
6. Odpojte MSFS. Příkazy musí vracet HTTP 409, nikoliv falešné úspěchy.
7. Vypněte ovládání z Windows; token na iPadu musí přestat platit.
8. Pokud XPDR či rádio nepodporuje daný SimVar, nesmí to zastavit PFD.
9. Restartujte Windows host: ovládání musí být opět vypnuté.

## Implementační omezení

- Na Linux CI nelze připojit reálný MSFS: event mapping a XPDR se testují deterministicky; skutečné ovládání je nutné prověřit na Windows s MSFS.
- Frequency SimVars se mohou u různých letadel lišit; UI nevydává nulový údaj za podporovaný.
- Samostatný low-level SimConnect command handle má být na Windows ověřen včetně chybového callbacku a reconnectu; do potvrzení všech typů letadel jde o experimentální ovládání.

## C3 – G1000 (následná samostatná etapa)

Získat Input Events z integrované diagnostiky; s podporovanými aircraft profily
ověřit FMS knobs, softkeys, Direct-To, Menu a CLR. Nikdy neposílat
libovolné Input Events podle názvu z browseru. Každý event omezit allowlistem.

## C4 – navigace (následná samostatná etapa)

GPS flight plan, nejbližší waypoint, vzdálenost, ETA, CDI, traťový kurz;
rozšíření MapLibre bez rozbití stávající moving map/historie. Srozumitelně
oddělit polohu letadla od plánované trasy a stav GPS navigace.
