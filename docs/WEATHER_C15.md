# C15 – NOAA Aviation Weather

Integrovaná záložka `/weather` stahuje na vyžádání **METAR a TAF**
z oficiálního [Aviation Weather Center API](https://aviationweather.gov/data/api/).
Stačí internetové připojení. **Žádný program ani API klíč neinstalujeme.**

Bridge používá pevné HTTPS endpointy `/api/data/metar` a
`/api/data/taf`, čtyřpísmenný ICAO identifikátor, max 8 KiB na
výsledek, timeout 10 sekund, aplikační User-Agent, 10min cache a
minimálně 2 s mezi sadami dotazů; při výpadku může vrátit poslední
úspěšný stav. Web nic nestahuje z NOAA přímo (bez CORS).

Zobrazení neznamená, že MSFS používá stejné podmínky v daném okamžiku.
Aviation Weather Center pokrývá METAR/TAF celosvětově; SIGMET
má odlišné zeměpisné pokrytí a bude řešen odděleně tak, aby nebyl
nepravdivě zobrazován jako globální. Rychlé NOAA API testy jsou
nezávislé na internetu, live připojení je třeba ověřit ve Windows.
