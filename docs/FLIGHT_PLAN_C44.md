# C44 – GPS / importovaný plán: důkazní kontrola V3

Stávající porovnání na /map nyní rozlišuje **shodu GPS polohy i názvu**,
**shodu polohy bez potvrzeného názvu**, **pouze shodný identifikátor** a
**výslovný konflikt** (shodný identifikátor vzdálený více než 10 NM).

Shoda jen podle ID se už neprezentuje jako potvrzený match, protože
různé body mohou mít stejné identifikátory. Pokud jsou dostupné souřadnice
GPS a importovaných waypointů, porovnání uvádí index souhlasícího bodu
a vzdálenost. Poloha do 2 NM odpovídá orientačně, není to záruka
shodného pořadí ani aktuálnosti plánů.

GPS navigace je **pouze čtená** ze SimConnectu. Import .PLN / SimBrief
zůstává samostatný plán v prohlížeči; nic se nepřenáší do G1000/G3000
ani autopilota. Úplný seznam nativních waypointů MSFS nejsme schopni
prokázat ze standardních dostupných SimVars; žádnou automatickou
synchronizaci nevymýšlíme. Skutečné testy issue #24 zůstávají otevřené.
