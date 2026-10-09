# A320-01 – ochrana identity a neověřených AP povelů

Primární testovací letadlo je původní Asobo A320neo (MSFS 2020).
Resolver nyní označuje prostý A320 TITLE jako
`a320-asobo-candidate`, ale **Verified=false**: samotný text TITLE
neprokazuje instalaci původní Asobo V1. Addony A32NX/Fenix/iniBuilds
se za Asobo nevydávají.

SimConnect bridge po spojení zjišťuje TITLE a následně
ho odebírá nezávisle každou sekundu. Změna či ztráta identity
**okamžitě odebere důvěru v příkazy** a připojení se znovu
naváže se smazanými sekundárními daty. Neplatná/stará
identita (10 s) nemůže odeslat příkaz. Stav je read-only
`GET /api/aircraft/identity`, s atributem `trusted`.

Pro každý známý Airbus / A320, včetně rozpoznaných variant A318/A319/A321,
A330/A350/A380 a samostatných názvů iniBuilds, se blokují generické
`autopilot.*` Key Events – včetně AP on/off a heading/
altitude/vertical speed. Zbytek stávajícího povoleného
ovládání funguje se stejnými LAN/CSRF omezeními a rate
limitem. Ovládací panel blokaci AP transparentně ukazuje.

Nejde o hotovou Airbus FCU integraci. Ta bude čtecí
v A320-02/A320-03 a následně vyžaduje samostatné
ověření konkrétních Input Events na skutečném Asobo A320neo.
