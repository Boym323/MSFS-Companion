# Kokpit – stav projektu a akceptační limity

**Aktualizováno:** 12. října 2026. Tento dokument odlišuje implementaci
od výsledků automatických testů a od skutečného pilotního ověření MSFS 2020.

## Stabilizační etapy A–G

| Etapa | Implementace | Doložené ověření | Neuzavřené omezení |
| --- | --- | --- | --- |
| A – síťová bezpečnost | Ochrana `Origin` u WebSocketu, negativní testy | PR #136, CI PASS | Záměrně bez autentizace v důvěryhodné LAN |
| B – CI/CD | Release gate na stejném SHA, automatické vyhledávání testů | PR #137, CI + instalační workflow PASS | Každé vydání se ještě musí dokončit a zveřejnit |
| C – Airbus A320 | Pilotní checklist, omezený FCU/WASM export | PR #138, CI a vizuální PASS | Funkce na originálním Asobo V1 musí potvrdit pilot |
| D – výkon | Sdílené JSON snímky WebSocketu, diagnostická počitadla | PR #139, CI + bezpečnostní audit + vizuální PASS | CPU/RAM/latence vyžadují provozní měření |
| E – UX | Kompaktní FCU iPad/mobil, zachované originální zobrazení | PR #140, CI a Chromium vizuální PASS | Není doložen fyzický iPad ani živý A320 |
| F – release bezpečnost | Fail-closed guard a self-testy watchdogu (PR #141) | K datu zápisu otevřený PR, kontroly probíhají | Experimentální watchdog zůstává **default OFF** |
| G – dokumentace | Aktuální stav, sjednocení popisků a oprava zastaralých tvrzení | Probíhá v samostatném PR | Dokumentace nenahrazuje živou akceptaci |

## Co neznamená úspěšné CI

- Test bez MSFS neprokazuje účinek FCU H-Events, přítomnost skutečné
  FMA indikace ani plnou funkčnost MCDU/ECAM.
- Chromium screenshot není totéž jako test ve skutečném Safari na iPadu.
- Windows silent installation na GitHub runneru není důkazem automatického
  rollbacku po záměrně poškozené aktualizaci na skutečném PC.
- Procesní WebSocket metriky po restartu začínají od nuly;
  neobsahují end-to-end latenci, CPU ani spotřebu RAM.

## Následující praktická akceptace

1. Vypnout experimentální rollback; na odděleném Windows testovacím účtu
   ověřit scénáře A→B a obnovu do A podle
   [Stabilization & Acceptance](STABILIZATION_ACCEPTANCE.md).
2. Na původním Asobo A320neo V1 ověřit přesný `TITLE`, FCU, WASM,
   režimy a reconnect; důkazy se zapisují na `/validation`
   podle [Airbus acceptance](ACCEPTANCE_A320.md).
3. Ověřit na reálném iPadu orientaci na výšku/šířku, čitelnost,
   dotyk a přepínání kompaktního/full FCU.
4. V živém letu měřit CPU/RAM procesu, frekvenci SimConnect,
   stale snapshoty, WebSocket cache a stabilitu připojení.

**Síťová bezpečnost:** Kokpit je určen jen pro důvěryhodnou soukromou LAN.
Před zveřejněním na internetu by byly nutné autentizace, TLS a nový audit.
