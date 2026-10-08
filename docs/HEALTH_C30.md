# C30 – System Health Center

Samostatná stránka `/health` čte každých 10 s `/api/health/overview`. Používá existující singletony a poslední známé stavy SimConnect, systémových SimVars, OurAirports, NOAA, VATSIM, rádií a GPS. **Nevytváří nové spojení s internetovými službami** a neodesílá žádné povely simulátoru.

Stav `configured` mDNS **není důkazem**, že UDP 5353 multicast skutečně funguje. `cachedAirports` NOAA není test aktuální dostupnosti služby a režim mock je označen jako `test`, nikoli simulátor online.

Export JSON z prohlížeče zahrnuje pouze agregované metriky, názvy diagnostických stavů a stáří cache, nikoli GPS trasu, názvy letů, IP adresy či systémové cesty. Citlivý log s podrobnostmi sdílejte až po kontrole.

HTTP smoke regresní test ověřuje přítomnost jednotlivých údajů i ve vývojovém mock režimu. První skutečný test připojení k iPadu/MSFS proběhne na Windows.
