# A320 cockpit expansion: EFIS/ND and Overhead/ECAM V1

Kokpit pro **původní Asobo A320neo V1 v MSFS 2020** nyní obsahuje
nové funkční webové sekce nad již existujícími read-only API.

## A320-UI-2: EFIS / lokální ND

- `ARC` a `ROSE NAV` jako **lokální režimy webového ND**, nikoli režimy
  skutečného Airbus EFIS.
- Rozsahy: 10/20/40/80/160/320 NM; nevysílají SimConnect příkazy.
- Živý směr a vzdálenost k aktivnímu GPS waypointu se počítají z platných
  souřadnic a aktuální polohy letadla. Podporuje přechod datové hranice ±180°.
- Na mapě není doplňována neznámá trasa, žádné falešné SID/STAR ani
  fiktivní radionavigační symboly.
- Při ztrátě identity A320, při staré telemetrii nebo při neaktivním
  waypointu se body nezobrazují.
- Ovládání `ILS`, `VOR`, `PLAN`, `CSTR`, `WPT`, `VOR.D`,
  `NDB`, `ARPT`, `LS` a `FD` zůstává disabled, protože
  konkrétní originální A320 readback/události nebyly ověřeny.

## A320-UI-3: Overhead / ECAM readback

- Indikace generických SimVars:
  LAND, TAXI, NAV, BEACON, STROBE, PITOT HEAT, PARK BRK.
- ECAM referenční přehled:
  N1/N2, fuel flow pro ENG 1 a ENG 2,
  APU RPM/GEN, celková hmotnost paliva v librach.
- Doplňkový flight director a A/THR arm jsou pouze obecné SimConnect
  autopilot stavy, nikoli plné Airbus FMA.
- Aktuálnost všech zdrojů se ověřuje nezávisle:
  A320 engine/aux/modes a `/api/cockpit/systems`.
  `/api/cockpit/systems` se čte pouze po rozpoznání A320 a
  výsledek je navázaný na konkrétní TITLE letadla.
- V nepřipojeném nebo zastaralém stavu se používá `—`.
  Není odhadována poloha fyzického přepínače v letadle.
- Žádné nové řídicí příkazy. V této fázi nelze z webového
  panelu zapnout APU nebo změnit světla Airbusu bez ověření
  jejich mapování a následné změny ve skutečném simulátoru.

## Bezpečnost a provedení

UI nepřidává nové procesy na PC. Vše běží ve stávajícím
React webovém rozhraní a čte stávající bridge API.
Nezavádí druhý SimConnect bridge, novou instalaci WASM
ani cloudové služby.

## Následující akceptační kroky

1. Srovnání aktivního ND/EFIS a Overhead stavů s původním
   A320neo V1 při simulaci na zemi.
2. Ověření skutečného chování Airbus-specific H-events a
   přepínačů z bezpečných testů.
3. Až po důkazu skutečného readbacku přidat ovládání EFIS,
   světel, APU a validovaný MCDU keypad.
4. A320 specifické PFD/ND/ECAM displeje řešit samostatně,
   nepovažovat tento orientační readback za jejich repliku.
