# Backend Airbus-only: bezpečné odstavení Garmin povelů

Původní G1000/G3X/G3000/GNS43x/53x SimConnect Input Events katalog,
extra SimConnect klient a příkazové handlery jsou odstraněny. Staré GET
a POST URL v `/api/avionics/*` vrací **410 Gone** a nikdy neodešlou
příkaz do simulátoru.

Endpoint `GET /api/aircraft/capabilities` zůstává jako rychlá
**read-only diagnostika**. Odpovídá podle připojení a čerstvého
`AircraftIdentityGuard.Trusted`; nikdy z pouhého TITLE nedovozuje
plnou funkčnost FMS, MCDU nebo volitelné Input Events. Stav
`a32nx_candidate` / `inibuilds_v2_candidate` vždy znamená
neověřeného kandidáta. `asobo_v1_legacy_candidate` je pouze
dočasná kompatibilita. Fenix, A380 a ostatní modely jsou
`unsupported_aircraft` (obecná letová telemetrie zůstává).

Pasivní profily C172/NXCub/XCub/TBM/DA40/DA62/Bonanza/Caravan jsou
odstraněny. Neznámé TITLE spadá do generického, neverifikovaného
profilu. `IsAirbusLike` záměrně chrání i ostatní Airbus varianty
před obecnými AP povely.

Nedotčeny jsou `/api/aircraft/profile`, PFD, rádio, flight recorder,
mapa, flightplan, SimBrief, LAN politika, Asobo V1 FCU a WASM.
Závislý webový PR #148 musí být schválen před tímto PR.

Testy: `tests/capabilities`, `tests/compatibility-lab` jsou
nahrazeny regresí kandidátních Airbus profilů a výslovného `false`
pro ověřený FMS/ovládání. Testy identity `tests/profiles` ověřují
generický fallback. V CI se již nespouští odstraněný G1000 test.
Provést kompletní bridge/test/Windows build a smoke endpointů včetně 410.
