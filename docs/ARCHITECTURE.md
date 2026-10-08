# Architektura MSFS Companion

MSFS Companion tvoří místní bridge ASP.NET Core, React dashboard,
Windows hostitel na pozadí a samostatná diagnostika SimConnect B1.

## Datový tok

```text
MockTelemetrySource -> TelemetryStore -> HTTP /api/telemetry
                                      -> HTTP /api/status
                                      -> WebSocket /ws -> React dashboard
```

Bridge zatím používá simulovanou telemetrii. Etapa B2 přidá
`SimConnectTelemetrySource` pro Microsoft Flight Simulator 2020.

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
