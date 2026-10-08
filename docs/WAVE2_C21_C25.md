# Vlna 2 – C21, C23, C24, C25

Bez dalších Windows programů; MSFS Companion využívá stávající SimConnect, OurAirports a NOAA.

## C21 SIGMET
Mapa umožňuje vypnout/zapnout mezinárodní SIGMET z oficiálního
`https://aviationweather.gov/api/data/isigmet?format=geojson`.
Backend používá 10min cache, omezení 4 MB odpovědi, 2min backoff a striktní
kontrolu GeoJSON geometrie. Kreslí se pouze platné vnější obrysy typu Polygon.
MultiPolygon a chybějící geometrie se **nevymýšlí**. Přibližné prostorové
filtrování neznamená průnik s přesnou trasou; nepoužívat pro skutečnou navigaci.
G-AIRMET s americkým omezeným pokrytím není součást této etapy.

## C23 Letištní briefing
`/briefing` spojuje lokální OurAirports detail letiště (dráhy, COM frekvence)
a NOAA METAR/TAF podle ICAO. Přehled vydává datum dostupných údajů a může
zobrazit starší počasí. Údaje mohou být odlišné od letištního modelu MSFS.

## C24 Průběh letu
`/progress` čte stávající navigační SimVars. Ukazuje aktivní GPS bod,
pořadí v plánu, vzdálenost, XTK, úhel mezi požadovanou a aktuální tratí,
ETE a odvozený **ETA pouze k následujícímu waypointu**. Nejde o ETA přistání.

## C25 Fuel Monitor
`/fuel` čte palivo z existujícího 1Hz AircraftSystemsStore a na stránce
každých 10 sekund sleduje úbytek v galonech. Pro odhad spotřeby musí být
minimálně dvě minuty souvislých a validních vzorků s měřitelným poklesem.
Po změně letadla, doplnění paliva nebo přerušení se výpočet resetuje.
Nejde o certifikované měření průtoku; při nedostatku podkladů zůstává „—“.

## Testy
.NET parser SIGMET polygonů a odmítnutí neplatného radiusu;
Node testy výpočtu paliva (doba, tankování, přerušení), TypeScript build.
Skutečné online načtení SIGMET, cache a chování MSFS stále vyžadují praktické
ověření na Windows a iPadu.
