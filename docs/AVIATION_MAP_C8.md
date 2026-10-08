# C8 – letecké vrstvy Little Navmap

Mapa `/map` nabízí volitelný přepínač „Letiště / VOR / NDB“.
Data čte backend z dokumentovaného API nezávisle běžícího
[Little Navmap](https://github.com/albar965/littlenavmap),
standardně z `http://127.0.0.1:8965/api/map/features`.
Little Navmap musí být spuštěný **na stejném Windows PC** a jeho
vlastní webový server musí být aktivní.

Bridge poslouchá stále pouze důvěryhodnou LAN. Proxy nesmí přijímat
volitelné cílové URL ani host: směřuje pevně na loopback port 8965.
Dotaz na mapu má omezený rozsah ±0,75 stupně, zaokrouhlené centrum,
limit 300 vykreslovaných bodů, timeout a 30s cache.
Neprovede se žádný dotaz, pokud uživatel vrstvu nezapne.
Při nedostupnosti Little Navmap zůstává stávající OSM mapa, stopa
letu i GPS waypoint beze změn.

**Rozsah C8:** letiště, VOR a NDB. Runway layout, SID/STAR a úplné
vzdušné prostory se zatím nezobrazují; jejich zpracování vyžaduje
samostatné datasety/endpointy a ověření licencí dat.
