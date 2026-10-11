# C4 – GPS navigace a aktivní waypoint

## Funkce
- Nové read-only API `GET /api/navigation/current`: aktivita flight planu,
  index/počet waypointů, GPS ident aktuálního bodu (pokud SimConnect vrací),
  předchozí/další GPS pozice, ETE, požadovaná trať, XTK, vzdálenosti.
- Samostatná 1Hz SimConnect subscription; stávající PFD 20 Hz se nemění.
- Na `/map` se vykresluje žlutý přerušovaný **aktivní leg**, odlišný od
  modré proletěné stopy. Zobrazení lze vypnout. Podklad a historie zůstávají.
- Nulové 0,0, nesmyslné souřadnice a stale vzorky jsou považovány za nedostupné;
  při odpojení nebo restartu se navigační data vymažou.
- **Žádné vymyšlené flight-plan legy**: standardní GPS SimVars popisují
  zejména aktuální a předchozí waypoint, index/count a celkovou délku plánu.
  Kompletní seznam waypointů nelze z těchto SimVars získat; pro úplnou trasu lze nyní v prohlížeči **ručně importovat soubor .PLN**.

## Ověření v MSFS 2020
1. S C172/G1000 aktivovat flight plan s alespoň třemi body.
2. Ověřit index, NEXT ID, vzdálenost NM a skutečný cíl žluté čáry.
3. Direct-To, další leg, změna letadla; nepodporovaná avionika hlásí neznámá data.
4. Odpojit MSFS: endpoint vrátí connected=false a žádnou starou trasu.
5. Zkontrolovat souběžně PFD, mapový podklad OSM i mapu v historii letu.

## Omezení
Kompatibilita GPS SimVars a skutečné chování avioniky budou ověřeny na Windows
s MSFS 2020. CI testuje převody, invalidaci a mock, ne reálné GPS.

## Import úplného flight planu

Mapa umožňuje vybrat lokální soubor `.PLN` (MSFS XML, DMS souřadnice). Parsování probíhá v prohlížeči, soubor se neodesílá na server. Fialová čára je **ručně importovaná plánovaná trasa**, nikoli automaticky synchronizovaná skutečná avionika. Velikost souboru je omezena na 2 MB a maximálně 200 waypointů; plán lze odebrat.

## Přehlednější plánování a briefing

Na `/flight-plan` je SimBrief Pilot ID a načtení OFP v jedné kartě.
Po úspěšném importu je odkaz na mapu přímo u výsledku; pod plánem
jsou také odkazy na mapu, letištní briefing a aktivní GPS úsek.
V `/briefing` sdílí vyhledání letiště a ruční ICAO jedno místo,
METAR/TAF a přepočet větru pro dráhy jsou vedle sebe na desktopu
a pod sebou na mobilu. Údaje zůstávají informační a nejsou
pokynem pro skutečný let.
