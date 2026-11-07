# Lazy-loading a snížení vstupního balíčku webu

V rámci samostatného výkonového PR jsou všechny hlavní React obrazovky
převedeny na `lazy()` + `Suspense`. Drobné statické stránky
bez telemetrie jsou přes `memo()` chráněné před zbytečnými rendery
při 20Hz WebSocket aktualizacích společné aplikace. PFD a mapa se
nadále aktualizují s novými skutečnými daty. Přidán čitelný
`role=status` placeholder pro asynchronní načtení.

CSS pro VATSIM, počasí a profil letadla se importuje až s jejich
obrazovkou; globální `style.css` a CockpitHeader zůstávají v
počátečním načtení. Vizuální automatické testy čekají na dokončení
lazy importu před vytvořením screenshotu.

**Měření potřebné k akceptaci:** porovnat výchozí JS/CSS
a gzip velikosti Vite `dist/assets`, počty HTTP požadavků při
otevření `/admin`, P50/P95 do prvního vykreslení PFD a mapy,
React render counts a CPU/RSS při 15 minutách letu.
Lazy-loading sám o sobě neznamená prokázané zrychlení
MSFS ani snížení runtime spotřeby CPU. Kontrola na skutečném
iPadu zůstává nutná.

Tento PR vychází z backend refaktoru PR #149 a nesmí se slučovat
přímo do main dříve než jeho rodičovské PR. Žádný SimConnect,
FMS ani pilotní povel nebyl změněn.
