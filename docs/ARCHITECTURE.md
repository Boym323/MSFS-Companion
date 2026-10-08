# Architektura MSFS Companion

MSFS Companion je webová aplikace pro Microsoft Flight Simulator 2020
se samostatným backendem a volitelným hostitelem pro Windows.

## Datový tok

```text
MockTelemetrySource -> TelemetryStore -> GET /api/telemetry
                                      -> GET /api/status
                                      -> WebSocket /ws -> React dashboard
```

Produkční bridge zatím používá **simulovaná data**. V plánované etapě
B2 nahradí tento zdroj implementace `SimConnectTelemetrySource`
na Windows. Frontend zůstane na zdroji dat nezávislý.

## Rozhraní

- `GET /api/status` – režim a stav zdroje dat.
- `GET /api/telemetry` – poslední snímek telemetrie.
- `WS /ws` – pouze čtení; JSON přibližně 20× za sekundu.
- `GET /api/admin/updates/status` – stav updateru; vyžaduje klíč Windows hostitele.
- `POST /api/admin/updates/check` – požadavek na kontrolu a instalaci novější verze;
  vyžaduje stejný klíč.

Telemetrie používá JSON s názvy vlastností ve formátu camelCase.
GPS souřadnice jsou ve stupních, výška ve stopách, rychlost v uzlech,
vertikální rychlost ve stopách za minutu a čas v UTC ISO 8601.

## Hranice zabezpečení

Backend standardně naslouchá **jen na 127.0.0.1:8765**.
Správcovská API jsou při samostatném spuštění bridge **vypnutá**;
hostitel pro Windows jim předává náhodný přístupový klíč a cestu
k souborovému kanálu v profilu aktuálního uživatele.

Autorizovaný požadavek z webu vytvoří lokální souborový požadavek.
Windows hostitel jej převezme a spustí svou již existující
aktualizační proceduru. Web nikdy nespouští libovolné příkazy systému.

Pro vzdálený přístup doporučujeme **Tailscale Serve**: šifrovaný tunel
přeposílá soukromý HTTPS provoz na místní `127.0.0.1:8765`.
Klíč nikdy nevkládejte do URL a nezpřístupňujte bridge veřejným portem.
`Tailscale Funnel` se pro tento účel nesmí použít.

## Další plánované funkce

- `SimConnectTelemetrySource` a konzistentní vzorkování dat.
- Bezpečné párování dalších zařízení a profily vstupních událostí.
- Explicitně povolené povely autopilota a rádií.
- Podepisování Windows sestavení a obnova po selhání aktualizace.

Projekt neobsahuje kód pod licencí AGPL z MSFS Mobile Companion App
ani MSFS Glass.
