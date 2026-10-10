# A320-UI-4 · MCDU Companion V1

## Rozsah implementace

Původní **Asobo A320neo V1** v **MSFS 2020**.

Kokpit nabízí v `/a320` další sekci MCDU Companion:
- Obrazovka se stránkami F-PLN, PROG a STATUS pro **lokální navigační diagnostiku**.
- Aktivní GPS úsek z existujícího nezávislého SimConnect navigačního čteče:
  směr, vzdálenost, ETE, pořadí aktivního bodu a známý identifikátor.
- Expirace informací po 6 sekundách, vazba na identitu přesného TITLE,
  zamítnutí jiných Airbus variant (FBW, Fenix, iniBuilds).
- Explicitní endpoint `GET /api/a320/mcdu/status` s capability fields:
  `mcduScreenAvailable=false`, `mcduKeysAvailable=false`,
  `mcduFlightPlanVerified=false`, `keyActions=[]`.
- Skutečná MCDU klávesnice je ve webu zobrazená, ale **disabled**.
  Přepínání lokálních diagnostických stránek nemění MCDU v letadle.
- Žádná nová aplikace ve Windows, žádný paralelní bridge, žádné nové
  WASM operace ani změna bezpečnostního modelu.

## Co data NEREPREZENTUJÍ

Obecné `GPS ...` SimVars nejsou vnitřní stav FMS/MCDU Airbusu.
V1 **neumí číst LCD obsah MCDU**, vnitřní kapitoly PERF/INIT/RAD NAV,
kompletní flight plan včetně SID/STAR, MCDU scratchpad ani line-select
keys. Kokpit si tyto položky nikdy nevymýšlí. Stisknout neověřenou
klávesu z webu není možné; backend nemá žádnou POST MCDU cestu.

MSFS 2020 SimConnect SDK nabízí obecná letová data, nikoli automatický
capture HTML/JS avionického přístroje. Původní avionika A320neo má interní
JavaScript instrument model. WASM umí číst konkrétní ověřené `L:`
proměnné, ale bez prokázaného stabilního kontraktu nelze předpokládat
obsah celé obrazovky.

Zdroje:
- https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm
- https://docs.flightsimulator.com/html/Programming_Tools/JavaScript/JavaScript.htm
- https://devsupport.flightsimulator.com/t/read-flightplan-waypoint-names-and-distance/4057

## Technický kontrakt

```http
GET /api/a320/mcdu/status
```

Response pouze po simulátorově potvrzené Asobo A320 TITLE:
```json
{
  "connected": true,
  "aircraft": "Airbus A320 Neo",
  "profileId": "a320-asobo-candidate",
  "mcduScreenAvailable": false,
  "mcduKeysAvailable": false,
  "mcduFlightPlanVerified": false,
  "keyActions": [],
  "source": "generic_gps_simvars",
  "gpsAgeMs": 1000,
  "gps": {
    "flightPlanActive": true,
    "waypointActive": true,
    "nextWaypointId": "BERDI"
  }
}
```

Zkrácené JSON pole `gps` v příkladu vynechává ostatní GPS položky,
které reálné API vrací. Nejde o získaný živý záznam.

## Akceptace další etapy

1. V reálném MSFS ověřit letadlo, dostupnost originální MCDU LCD a
   mapování jeho interních událostí podle stock aircraft package.
2. Získat **stabilní a měřitelný stav MCDU** (obsah stránek nebo
   prokázané avionické stavové proměnné) bez instalace dalšího softwaru.
3. Následně rozšířit současný in-sim WASM modul o
   pevný seznam ověřených MCDU operací. Nikdy nepovolit obecný
   spouštěcí řetězec / libovolný H-event nebo LVar write.
4. Až po in-sim readback testu zapnout první bezpečné MCDU
   klávesy a status indikace jejich skutečného účinku.

## Testy

`tests/airbus-logic/Program.cs`: originální A320 profil,
neznámé varianty, stará data, změna identity, reset navigace,
nulové MCDU capability a zákaz MCDU příkazů.
`apps/web/src/a320/mcduModel.test.mjs`: freshness,
validace profilu, neznámé waypointy a vypnutá klávesnice.
