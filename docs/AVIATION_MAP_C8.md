# C8 V2 – integrovaná letecká mapa OurAirports

**Žádný další program na Windows není potřeba.** Little Navmap proxy a
závislost na běžícím lokálním serveru port 8965 byly nahrazeny daty
[OurAirports](https://ourairports.com/data/), uvolněnými do **public domain**.
Data se aktualizují průběžně komunitou; zdroje CSV jsou obnovovány denně.
Nejde o oficiální aeronautická data pro skutečný provoz.

## Odkud se data berou

Bridge na Windows při prvním zapnutí mapové vrstvy načte 4 pevné HTTPS soubory:
- `airports.csv` – letiště, identifikátor, poloha, typ, výška
- `runways.csv` – otevřené dráhy, koncové souřadnice, délka a povrch
- `navaids.csv` – VOR/VORTAC/NDB/DME, poloha a dostupná frekvence
- `airport-frequencies.csv` – ATIS/TWR/GND a jiné letištní frekvence

Přímý veřejný zdroj: `https://davidmegginson.github.io/ourairports-data/`.
Žádné API tokeny, žádná instalace ani spuštění dalších aplikací.
Webový klient (iPad/Mac) **nestahuje CSV**. Dostane nejvýše 240 objektů
v okolí aktuální polohy přes API na našem bridge.

## Aktualizace a offline chování

- Data se obnovují nejdřív po **24 hodinách** od posledního úspěšného stažení.
- Při chybě připojení se další pokus provede nejdřív za 15 minut.
- Po každém úplném stažení všech čtyř souborů proběhne kontrola souborů
  a atomické přepnutí snímku; nedokončená data se nikdy nepublikují.
- Poslední úspěšná kopie je uložená jako komprimované JSON v
  `%LOCALAPPDATA%/MSFS Companion/aviation/ourairports-v1.json.gz`.
  Po restartu Windows funguje i bez internetu se starší cache.
- První stažení (desítky MB) probíhá na pozadí. Když ještě cache neexistuje,
  mapa zobrazí „Načítám“, ale PFD, GPS, trasa, OSM a Flight Recorder
  fungují bez čekání.
- Limit velikosti jednotlivých souborů a odpovědí chrání před
  nepřiměřenou spotřebou RAM; důležitá data vrací API jen v okolí letadla.
- Externí URL nejsou konfigurovatelné browserem (bez SSRF).

## API

- `GET /api/map/aviation?lat=50.1&lon=14.26&radiusKm=70`
  vrací `available`, `loading`, `stale`, `updatedAt`, `source`,
  `features` (airport, runway, vor, ndb, dme). Radius 5–200 km.
- `GET /api/map/aviation/airport/LKPR` vrací dráhy a letištní frekvence.
  Příjem nevykonává žádné kokpitní příkazy.

Mapa `/map` nabízí přepínače leteckých vrstev, podrobné
vykreslení drah při přiblížení a panel nejbližších letišť. Kliknutím na
letiště lze zobrazit seznam drah, jejich povrch, délku a frekvence.

## Limity a testování

OurAirports údaje nemusí být totožné s letištní databází uvnitř
MSFS 2020 a nejsou zaručeně aktuální. Neobsahují kompletní
vzdušné prostory, postupy SID/STAR, IFR charts ani přesné
letištní taxiway mapy. Vykreslování drah používá dostupné
koncové souřadnice a nepřidává neznámou geometrii.

Pro C8 existuje deterministický .NET test CSV parseru včetně uvozovek,
drah, frekvencí, antimeridiánu a omezení okolí. Browser build kontroluje
TS/JSX. GitHub CI nedokazuje dostupnost veřejného serveru při letu;
při prvním nasazení ověřit skutečné online stažení a lokální cache.
