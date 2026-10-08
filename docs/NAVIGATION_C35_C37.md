# C35–C37 – postupné rozšíření mapy a navigace

## C35 – vzdušné prostory
Přes `/map` lze lokálně importovat textový OpenAir soubor. Podporovány jsou
hranice s přímými body `DP`, názvy (`AN`), třída (`AC`) a výškové limity
(`AL`, `AH`). Oblouky `DA`, `DB`, `DC` ani nesrozumitelná geometrie
se **nezobrazují**, aby nevznikl falešný tvar oblasti. Nejvýše 160 oblastí
s nejvýše 250 body na oblast. Údaje poskytuje pilot, Companion je nestahuje
automaticky. Doporučený veřejný zdroj pro podporované regiony:
https://openflightmaps.org/ (použití podle licenčních podmínek OFMA).
Nejde o kompletní ani garantovaně aktuální pokrytí vzdušných prostorů.

## C36 – letištní pojezdové cesty
Při zoom 13–15 a připojeném MSFS lze **ručně** požádat Overpass API o
komunitní objekty OpenStreetMap `aeroway=taxiway`, `taxilane` a
`holding_position` do 2,5 km kolem vlastní polohy. Není spuštěné
automatické dotazování na každém SimConnect snímku. Odpověď je omezená
časem, velikostí a počtem objektů, geometrie se validuje a staré letiště
se skryje po přesunu o více než 3,5 km. Pokud Overpass či CORS selže,
mapa a telemetrie fungují dál. © OpenStreetMap přispěvatelé (ODbL).
Chybějící taxiway v OSM neznamená, že v MSFS neexistuje.

## C37 – porovnání plánů
Stávající import PLN/SimBrief se porovnává s GPS aktivním waypointem
pouze orientačně, podle identifikátoru nebo polohy do 2 NM. Žádné
automatické nahrávání trasy do avioniky ani přepis flight planu.
Výsledek `uncertain` není důkazem nesprávného plánu.

## Omezení
Reálné zdroje se mohou lišit od databáze MSFS 2020, rozhodující je
zkouška na skutečném Windows MSFS a ověření autorských licencí.
