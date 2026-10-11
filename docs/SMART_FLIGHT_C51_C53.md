# C51–C53 – Smart Flight Companion

- **C51:** Na /pilot je volitelné automatické přepínání panelů podle potvrzené fáze letu. Výchozí stav je vypnutý. Neznámá fáze nic nepřepíná; ruční výběr vždy vypne automatiku. Nastavení je uloženo pouze v localStorage tohoto zařízení.
- **C52:** Odlet/přílet pochází výhradně z posledního uživatelem importovaného OFP a nikdy se nevydává za aktivní flight plan avioniky. NOAA počasí se načte jen pro dvě ICAO a pouze při otevřené stránce. Stará data nejsou zobrazena jako čerstvá. Přímé odkazy otevírají letištní briefing s předvybraným ICAO.
- **C53:** SimBrief import zobrazuje volitelné alternativní letiště, cestovní výšku a plánované palivo. Palivo zobrazujeme jen pokud má OFP validní jednotky KG/LB; rezervy a skutečnou spotřebu z toho neodvozujeme. Souhrn je pouze v sessionStorage na max. 24 hodin.
- Bez nových SimConnect subscriptions, instalací, automatických rádiových nebo avionických povelů. Pouze orientační podpora simulátoru.

Akceptace: frontend testy včetně validace SimBrief, TypeScript build a sedm viewportů Chromium. Živý MSFS/SimBrief výstup a fyzický iPad se musí ověřit odděleně.
