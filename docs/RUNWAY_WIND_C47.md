# C47 – informativní vítr pro letištní dráhy

Letištní briefing na /briefing získává METAR z existujícího lokálního
NOAA API a koncové souřadnice drah z existujícího OurAirports API.
Pro obě orientace dráhy spočítá **skutečný zeměpisný směr** podle
koncových bodů (neodvozuje jej z magnetického čísla dráhy)
a podélnou/boční složku větru, případně nárazy.

Výpočet je zcela lokální ve webovém prohlížeči a nezakládá další
SimConnect spojení. Není-li METAR čerstvý (stale, chybějící nebo
fetchedAt starší než dvě hodiny), má-li proměnlivý směr (VRB),
nejsou-li oba krajní body dráhy, nebo není-li letiště v databázi,
**výsledek se neodhaduje**.

Nejde o výběr aktivní dráhy, doporučení pro reálné přistání či
schválený výpočet letových výkonů. Nezahrnuje ATC, NOTAM, limity
letadla ani skutečné podmínky MSFS. Na letištích se změněným
značením nebo geometrií může být katalog OurAirports odlišný.
Regresní testy pokrývají severní/jižní směr, nárazy, VRB,
klidný vítr, chybné vstupy a staré zprávy.
