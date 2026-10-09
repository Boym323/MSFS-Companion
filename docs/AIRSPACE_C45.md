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
