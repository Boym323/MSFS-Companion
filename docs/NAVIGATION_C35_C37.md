# C35–C37 – postupné rozšíření mapy a navigace

## C35 – vzdušné prostory
Přes `/map` lze lokálně importovat textový OpenAir soubor. Podporovány jsou
hranice s přímými body `DP`, názvy (`AN`), třída (`AC`) a výškové limity
(`AL`, `AH`). Základní oblouky `DA`, `DB` a kružnice `DC` jsou nyní
přibližně vykresleny přes podporované `V X` a `V D`.
Neplatná, příliš složitá či nerozpoznaná geometrie se **vynechá**,
aby nevznikl falešný tvar oblasti. Viz [C45](AIRSPACE_C45.md). Nejvýše 160 oblastí
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

## C35 V2 – české prostory bez ručního importu

Ve volbě `Načíst české vzdušné prostory` mapa na vyžádání zavolá
místní `GET /api/airspace/czechia`. Windows bridge stahuje výhradně
pevný HTTPS soubor [Aeroklubu ČR](https://airspace.aeroklub.cz/docs/public/)
`CZ_all_26-04-01.txt` (zdroj deklaruje platnost od 1. dubna 2026).
Soubor je veřejně povolen pro sdílení a použití pro všeobecné letectví;
atribuce Aeroklub ČR / Jan Zahradka zůstává uvedena.

Stažení probíhá jen na kliknutí, nejvýše jednou za 24 hodin po úspěchu.
Pokus při chybě nejdříve po 15 minutách, limit 2 MB, 18 s timeout,
odmítnutí přesměrování a pevná cílová URL bez možnosti klientského SSRF.
V procesu zůstává poslední načtená kopie pro případ výpadku.

**Důležité:** Nejde o automaticky verifikovaný aktuální cyklus AIRAC ani
živé NOTAM. U neplatných nebo nepodporovaných složitých tvarů parser bezpečně
přeskočí celý objekt místo nepravdivého vykreslení. Podporované
oblouky se aproximují nejvýše po 5°; nejde o garantovanou
letecko-navigační přesnost.
Nepoužívat pro skutečnou leteckou navigaci.
