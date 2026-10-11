# C56–C57 · Flight Replay a iPad Experience

**C56:** Události rozpoznané ve stávajícím záznamu letu dostaly
tlačítko **Přejít na bod**. Kliknutí přesune přehrávač, kurzor v grafech
a GPS značku na mapě. Používá jen existující zaznamenaný časový
vzorek (max. rozdíl 1 sekunda), nikdy nevymýšlí polohu/interpolaci
a nevysílá příkaz do simulátoru. Analýza zůstává orientační.

**C57:** Na stránce /workspace lze ručně zapnout zamčení rozložení pro iPad.
Zamknutí zabrání omylem přidat, odebrat, přesunout nebo načíst jiné
panely, ale ponechá funkční celou obrazovku a přístup k přístrojům.
Nastavení je pouze v localStorage daného prohlížeče. Nezavádíme
povinné HTTPS, PWA offline aktualizaci ani další aplikaci na Windows.

Testy CI ověřují časové vyhledávání a frontend; skutečné MSFS/iPad
je nutno ověřit na zařízení.
