# C58 – AirRadar: externí skutečný provoz v Kokpitu

## Architektura
- Na /map je nová výslovně volitelná vrstva **AirRadar**.
- Windows bridge poskytuje pouze read-only GET
  /api/integrations/airradar/nearby?lat=…&lon=…&radiusKm=….
- Server využívá pevně zadané veřejné HTTPS API
  https://airradar.pomykal.cz/api/aircraft. URL není ovládaná klientem,
  přesměrování jsou vypnutá. Timeout 10 s, velikost odpovědi nejvýše
  8 MB, sdílená cache/limit 30 s a maximálně 40 nejbližších validních
  čerstvých cílů na odpověď.
- Prohlížeč dotazuje přes stávající privátní LAN bridge jen po zapnutí
  vrstvy. Přidávání dalších programů na Windows ani nové SimConnect
  subscriptions nejsou nutné.

## Pravdivé zobrazení
- Zobrazují se pouze cíle s validní hex identitou a GPS polohou
  aktualizovanou do 30 sekund; překročení expirace nebo výpadek feedu
  znamenají nedostupnost, ne údajně živé body.
- Zdrojem je AirRadar, nikoli interní MSFS traffic ani VATSIM;
  může zahrnovat jen část skutečného provozu, příjem závisí na pokrytí.
  Kosočtverec má odlišnou barvu i legendu a nepředstírá TCAS.
- Žádné povely, synchronizace nebo přenos polohy simulátoru
  do dalších účtů. Stávající LAN pravidla pro API zůstávají.

## Akceptace
- Build bridge a Windows hostitele, webové testy a Chromium matice.
- Ověřit živou dostupnost upstream AirRadar, mapové pozice a stáří
  proti produkci AirRadaru. Reálné MSFS a iPad zůstávají k ověření.
