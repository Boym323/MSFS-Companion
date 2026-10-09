# C45 – Airspace Intelligence V2: přesnější geometrie OpenAir

Původní import a české prostory na /map nově při načtení podporují
geometrické příkazy OpenAir:
- `DP`: jednotlivé vrcholy;
- `V X=`: zeměpisný střed;
- `V D=+` a `V D=-`: směr oblouku ve směru/proti směru hodinových ručiček;
- `DA radius,start,end`: oblouk mezi azimuty (radius v NM);
- `DB point1,point2`: oblouk přes dva body se zadaným středem;
- `DC radius`: kružnice v NM.

Souřadnice DMS a stupně/desetinné minuty (DDM) mají validované rozsahy.
Interpolace oblouku užívá geodetický přibližný výpočet po 5°,
nikoli nesprávnou přímou tětivu. Maximálně 250 vrcholů na oblast,
160 oblastí v importu, velikost 2 MB, poloměr 0,05–200 NM.
Nejasné, neúplné, nesouhlasící DB poloměry, polární či příliš
složité tvary se bezpečně **vynechají celé**.

Smíšené a nesprávně uzavřené hranice, datové limity nebo překryvy
mohou vyžadovat další testy na reálných OpenAir souborech.
Zejména C45 **neověřuje AIRAC cyklus, aktuální aktivaci prostoru
ani NOTAM**. Automatické testy ověřují konstrukci a validaci
geometrie, nikoliv kompletnost veřejných leteckých dat.

Zdroje formátu: původní WinPilot OpenAir a specifikace SeeYou/OpenAir 2.1.
Žádná nová služba ani software ve Windows nebyly instalovány.

## C45 V2.1 – kontrola stáří zdroje (informativní)

Současný server využívá veřejný soubor Aeroklubu s datem účinnosti
**1. dubna 2026**. Prohlížeč nyní odděluje stáří souboru od stáří
HTTP mezipaměti. Pokud je datový soubor starší než **56 dní**,
nebo je poslední aktualizace mezipaměti neúspěšná, vrstvy se
**samovolně nezapnou**: zobrazí se upozornění a vyžaduje se
výslovné potvrzení pro použití v simulátoru. Neznámé či budoucí
datum serverové vrstvy vede k odmítnutí.

Prahových 56 dní je pouze opatrný UI indikátor, **nikoli záruka
platnosti AIRAC**. Nevyhodnocujeme oficiální NOTAM, časovou aktivaci
prostoru ani právní status. Soukromě importované soubory OpenAir
nemají ověřený datum účinnosti – UI to výslovně uvádí.

## C45 V2.2 – automatické nalezení posledního vydání

Bridge se při čtení českých prostorů pokusí stáhnout omezený
oficiální index `https://airspace.aeroklub.cz/docs/public/`.
Z odkazů `CZ_all_YY-MM-DD.txt` vybírá nejnovější účinný soubor,
nejvýše aktuální datum, a skládá URL jen z pevné domény Aeroklubu.
Nemůže následovat libovolnou URL vloženou do HTML.

Při chybě katalogu se použije poslední bezpečně známý soubor
`CZ_all_26-04-01.txt`, ale API to označí jako neověřenou
aktuálnost; mapová vrstva vyžaduje ruční souhlas při starém
nebo neověřeném zdroji. Rozpoznaná nová data se načítají
nejvýše každých 24 hodin s omezením velikosti souboru.
Katalog Aeroklubu není NOTAM rozhraní ani živé řízení TSA/TRA.
