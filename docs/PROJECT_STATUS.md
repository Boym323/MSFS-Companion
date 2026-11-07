# Kokpit – stav projektu a akceptační limity

**Historický přehled:** původně 12. října 2026. Tento dokument odlišuje implementaci
od výsledků automatických testů a od skutečného pilotního ověření MSFS 2020.

## Nové rozhodnutí (7. listopadu 2026)

Experimentální Asobo V1 a nefunkční WASM byly na žádost uživatele
odstraněny v Draft PR #152. Recovery watchdog se ruší v návazném
Draft PR #153, avšak ruční obnova a bezpečnostní update journal
zůstávají. Další podpora se soustředí na FlyByWire A32NX a
iniBuilds A320neo V2. Tato změna **zatím není v main ani v produkci**.
Níže uvedené etapy jsou historickým záznamem původní implementace,
nikoli aktuálním doporučením.

## Stabilizační etapy A–G

| Etapa | Implementace | Doložené ověření | Neuzavřené omezení |
| --- | --- | --- | --- |
| A – síťová bezpečnost | Ochrana `Origin` u WebSocketu, negativní testy | PR #136, CI PASS | Záměrně bez autentizace v důvěryhodné LAN |
| B – CI/CD | Release gate na stejném SHA, automatické vyhledávání testů | PR #137, CI + instalační workflow PASS | Každé vydání se ještě musí dokončit a zveřejnit |
| C – Airbus A320 | Pilotní checklist, omezený FCU/WASM export | PR #138, CI a vizuální PASS | Funkce na originálním Asobo V1 musí potvrdit pilot |
| D – výkon | Sdílené JSON snímky WebSocketu, diagnostická počitadla | PR #139, CI + bezpečnostní audit + vizuální PASS | CPU/RAM/latence vyžadují provozní měření |
| E – UX | Kompaktní FCU iPad/mobil, zachované originální zobrazení | PR #140, CI a Chromium vizuální PASS | Není doložen fyzický iPad ani živý A320 |
| F – release bezpečnost | Fail-closed guard a self-testy watchdogu (PR #141) | CI PASS a Windows installer packaging PASS; sloučeno do main | Experimentální watchdog zůstává **default OFF** |
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

1. Na odděleném Windows testovacím účtu ověřit scénáře A→B,
   zastavení aktualizací po chybě a **ruční** obnovu do A podle
   [Stabilization & Acceptance](STABILIZATION_ACCEPTANCE.md).
   Experimentální automatický watchdog už není součástí návrhu.
2. Ověřit aktuální TITLE a telemetrii FlyByWire A32NX/iniBuilds V2
   v MSFS a propojení s dostupnými oficiálními MCDU rozhraními,
   nikdy nespouštět původní Asobo V1 WASM.
3. Ověřit na reálném iPadu orientaci na výšku/šířku, čitelnost,
   dotyk a přepínání kompaktního/full FCU.
4. V živém letu měřit CPU/RAM procesu, frekvenci SimConnect,
   stale snapshoty, WebSocket cache a stabilitu připojení.

**Síťová bezpečnost:** Kokpit je určen jen pro důvěryhodnou soukromou LAN.
Před zveřejněním na internetu by byly nutné autentizace, TLS a nový audit.
