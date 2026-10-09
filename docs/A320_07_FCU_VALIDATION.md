# A320-07 – bezpečná pilotní validace FCU

Na `/a320` je nový *read-only* postup:
1. Při čerstvém 1Hz FCU vzorku zachytit výchozí hodnoty.
2. Ručně změnit knob **v Asobo A320neo přímo v MSFS 2020**.
3. Zachytit nový vzorek; oba musí pocházet ze stejného
   přesného TITLE, odděluje je nový timestamp a nejvýše 15 minut.
4. Vyhodnotí se rozdíly SPD/MACH/HDG/ALT/VS a **raw**
   indexů speed/heading/altitude/VS. Výsledek
   `observed` znamená výhradně změnu SimVar,
   nikdy potvrzení ovládacího příkazu.
5. Diagnostiku lze stáhnout v omezeném JSON bez GPS či tokenů.
   Export pro sdílení obsahuje typ letadla a zjištěné FCU hodnoty;
   pilot má zkontrolovat soukromí před zveřejněním.

**Dálkové ovládání FCU/MCDU není tímto zpřístupněno.**
Generické `autopilot.*` Key Events jsou na Airbusu
stále blokované na serveru. Jejich povolení bez
skutečně ověřených jednotlivých událostí a
srovnání readbacku by nebylo bezpečným dokončením etapy.

Automatické testy `fcuEvidence.test.mjs`
ověřují invalidní identitu, žádné nové snímky,
vypršení, neměnnost a pozorované změny.
