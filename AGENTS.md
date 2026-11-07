# Pravidla projektu MSFS Companion

## Česká dokumentace

Veškerá uživatelská, vývojářská a provozní dokumentace projektu
musí být česky (`README.md`, `docs/`, návody a zprávy o nasazení).
Uživatelské webové a Windows rozhraní také používá češtinu.

Názvy API, příkazů, knihoven a označení externích nástrojů
ponechávejte v originále, pokud jsou potřebné pro přesnost.
Každou změnu funkce doprovází odpovídající aktualizace českého
návodu. Nepotvrzené chování se nesmí vydávat za hotové.

## Provoz pouze v domácí LAN

- Backend se při samostatném spuštění váže na localhost.
- Instalovaný Windows hostitel může přidat konkrétní
  privátní IPv4 adresu aktivního Wi-Fi/Ethernet adaptéru.
- Vzdálené ovládání aktualizací **nevyžaduje správcovský klíč**,
  protože je určeno pro důvěryhodnou domácí podsíť.
- Požadavky musí procházet kontrolou sítě a Host;
  změny stavu navíc kontrolou `Origin` a vlastní hlavičky.
- Neotevírejte port aplikace do internetu a nepoužívejte
  plošné naslouchání na veřejných rozhraních.
- Simulátor se při aktualizaci Companionu nikdy přímo neukončuje.
- Pokud někdy bude potřeba ovládání z nedůvěryhodných sítí,
  musí se znovu zavést autentizace a šifrované spojení.

## Směr Airbus-only (schválený produktový cíl)

- Prioritní podporované modely pro MSFS 2020: FlyByWire A32NX a iniBuilds A320neo V2.
- SimConnect, PFD, mapa, SimBrief, VATSIM, rádio, počasí, briefing, letový deník, bezpečnost a automatické aktualizace zůstávají společným jádrem.
- Staré G1000/G3X/G3000/GNS integrace se odstraňují po oddělených PR a regresních testech; neobnovovat je bez nového výslovného zadání.
- Uživatel výslovně rozhodl odstranit nefunkční Asobo A320neo V1 FCU/MCDU a WASM, stejně jako experimentální recovery watchdog. Tyto změny jsou v Draft PR #152 a #153. Nikdy neobnovovat původní Asobo H-event/WASM transport; nikdy automaticky nemazat již instalované soubory MSFS Community.
- Detekce podle SimConnect TITLE zůstává kandidátní; nikdy z ní nedovozovat podporu kláves MCDU, FMS ani neověřené Input Events.
- Před změnami datových formátů zajistit bezpečnou kopii settings.json a flights i zachování uložených profilů panelů v browseru.
- Žádné automatické mazání dat, odinstalace Community modulu, slučování do main nebo vydání produkční verze bez zvláštního schválení.
- Detailní harmonogram a odkazy na PR: docs/AIRBUS_ONLY_MIGRATION_PLAN.md.

- Z bezpečnostních důvodů zachovat ručně potvrzovanou obnovu z ověřeného offline balíčku, journal po aktualizaci a fail-closed chování při výpadku SimConnect.
