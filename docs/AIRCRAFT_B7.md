# B7 – přehled aktuálního letadla

## Otevření

Na Macu nebo tabletu ve stejné důvěryhodné podsíti jako
MSFS 2020 otevřete `http://IP_WINDOWS_PC:8765/aircraft`.

Panel kombinuje stávající **rychlou letovou telemetrii**
s odděleným read-only endpointem
`GET /api/aircraft/systems` (B6, cca 1 Hz).

K dispozici jsou přehledy:
- IAS, TAS, GS, indikovaná výška, AGL a VS.
- Stav autopilota a zvolené hodnoty kurzu, výšky a VS.
- Klapky, podvozek, stav na zemi, otáčky motoru č. 1,
  dostupné palivo.
- Směr/rychlost větru a GPS poloha.

## Profily a omezení

Základní označení `XCub`, `Cessna` a `Airbus`
se vybírá podle názvu letadla. Jde pouze o **univerzální
profil hodnot** – není to specifická avionika jednotlivých
variant, takže u některých letadel nebo modů mohou být
SimVars nepodporované, nulové nebo nesprávně interpretované.

Při výpadku MSFS se letové hodnoty skryjí. Pokud nefunguje
samostatný 1Hz systémový odběr, zobrazí se dostupné
rychlé údaje, ale nedostupné systémové veličiny se
označí pomlčkou – žádné předstírání skutečného stavu.

**Panel neobsahuje ovládání letadla.** Není zde možné
odeslat příkaz autopilotu ani jiný zápis do MSFS.

## Ověření na MSFS 2020

1. Načtěte skutečný let (například XCub Floats).
2. Z Macu otevřete `/aircraft`.
3. Porovnejte GS, TAS, AGL, vítr, klapky, otáčky
   motoru a palivo s údaji ve hře.
4. Ověřte přepnutí autopilota v kokpitu (jen zobrazení).
5. Ověřte chování při nedostupných SimVars a odpojení.
6. Test zopakujte u C172; jednotlivé varianty mohou mít
   odlišné dostupné hodnoty.

Veškerá funkcionalita je určena pouze pro
**Microsoft Flight Simulator**, nikoli pro skutečný let.
