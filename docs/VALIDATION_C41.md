# C41 – řízené porovnání telemetrie během validace MSFS 2020

Stránka /validation nově umožňuje během reálného testu zvolit
1. **Zachytit výchozí stav**, 2. změnit ovládací prvek přímo v MSFS,
3. **Zachytit stav po změně**. Srovnává dostupné read-only indikátory:
RPM, TAS, AGL, onGround, palivo, stav a index GPS waypointu, vzdálenost
a základní frekvenci telemetrie.

Podmínkou je živý SimConnect, správné časové pořadí a odstup nejvýše 15 minut.
Změna letadla resetuje baseline a záznam. Neporovnávají se nevalidní ani
nedostupné hodnoty. **Rozdíl není potvrzení funkčnosti ovladače** a jeho
absence není důkaz závady; výsledky jednotlivých scénářů zapisuje pilot.

Report JSON obsahuje oba sanitizované snapshoty a souhrn rozdílů. Dále
neobsahuje GPS souřadnice, historii trasy, raw chyby ani credentials.
Neprobíhá automatické ovládání SimConnectu, zápisy ani periodické testování.
Regrese jsou v compareEvidence.test.mjs.

Zbývá ruční ověření C172/G1000, XCub Floats na vodě a TBM v MSFS 2020.
