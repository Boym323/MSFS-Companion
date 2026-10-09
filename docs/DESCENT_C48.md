# C48 – informativní plán klesání k aktivnímu GPS waypointu

Na /progress si pilot nastaví **cílovou výšku MSL** a předpokládanou
vertikální rychlost (500/700/1000/1500 ft/min). Z existujícího
SimConnect GPS ETE a vzdálenosti k **aktuálnímu** waypointu se
odvodí přibližná ground speed a potřebná vzdálenost pro klesání.
Čas = (aktuální výška - cílová výška) / descent FPM.
Vzdálenost = ground speed × čas. Pokud data nestačí nebo jsou
nevěrohodná, panel zobrazí nedostupnost místo smyšleného výsledku.

Model předpokládá konstantní rychlost a klesání, nezapočítává
vítr v následujícím úseku, profil letadla, terén, omezení
přiblížení ani vzdálenost do cílového letiště. Nejde o
autorizovaný VNAV ani autopilot. Žádné řídicí příkazy se neposílají.

Deterministické testy zahrnují typický let, neplatné ETE,
neplatné výšky a situaci, kdy je orientační TOD již za pilotem.
