# Vyřazení Garmin avioniky z webu

Airbus-only frontend nevystavuje stránky G1000, G3X, G3000 a GNS430/530 v navigaci ani workspace. Historické adresy `/g1000` a `/avionics` zobrazují vysvětlení bez simulovaných dat či automatických povelů. Základní PFD, mapa, rádiové a letové údaje zůstávají zachované.

Uložené profily workspace v `localStorage` se **nemažou**. Při načtení se pouze odfiltrují ID `g1000` a `avionics`; zbývající panely se zachovají. Pokud nic nezbyde, otevře se PFD + mapa. Zůstávají i individuální checklisty, protože mohou obsahovat vlastní uživatelský text.

Backend G1000/advanced a katalog `/api/aircraft/capabilities` se zatím **nemění**: endpointy navzájem sdílejí `G1000Service` a musí být bezpečně vyřazeny v samostatném PR. Asobo V1 a WASM zůstávají až do akceptace obou cílových modelů. Integrační PR FlyByWire #144 není součástí tohoto rozdílu.

Regrese: `npm ci`, všechny Node testy, `npm run build`, vizuální testy v Chromium a načtení historického workspace s položkami `g1000`/`avionics`. Uživatelova Windows data se nedotýkají.
