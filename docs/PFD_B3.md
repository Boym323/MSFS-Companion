# B3 – Primary Flight Display (PFD)

## Otevření

Na počítači či tabletu ve stejné domácí síti otevřete
`http://ADRESA_WINDOWS_PC:8765/pfd`. Bez dalších klíčů
a bez instalace klientské aplikace.

PFD obsahuje umělý horizont se stupnicí klopení a náklonu,
indikovanou rychlost (IAS, uzly), indikovanou výšku (stopy),
vertikální rychlost (stopy za minutu) a magnetický kurz.

## Znaménka a vykreslování

Uživatelsky ověřené hodnoty MSFS 2020:

- `PLANE PITCH DEGREES`: **kladně = příď dolů**. Pro PFD se
  při vykreslení obrací, takže příď nahoru pohybuje horizontem dolů.
- `PLANE BANK DEGREES`: **kladně = levé křídlo dolů**.
  Viditelný horizont se vůči symbolu letadla otáčí opačně než letadlo.
- Magnetický kurz se normalizuje do `0–359°`; vyhlazování
  volí nejkratší úhlovou vzdálenost přes sever (`359° → 1°`).

## B3.1 – opravy rozložení a stupnic

Rozložení používá uzavřený SVG prostor o velikosti 1000 × 590
logických jednotek. Přístroj obsahuje **čtyři samostatné oblasti**:
rychloměr vlevo, umělý horizont uprostřed, výškoměr a
**vertikální rychloměr VSI** vpravo, pod nimi kompasovou pásku.

- Kompasové číslice i značky jsou vždy ořezány přímo uvnitř
  `clipPath`; nemohou zasahovat do postranních ukazatelů.
- Zrušili jsme duplicitní nadpisy pod kompasem. Doplňující
  údaje mají vlastní responzivní řádek **mimo SVG**.
- Rychlostní i výškové číslice mají dvě ořezové oblasti;
  prostředek pod pevným kurzorem zůstává čistý.
- U IAS = 0 se již nevykreslují několikrát stejné nuly;
  záporná rychlost se na stupnici nezobrazuje.
- VSI má čitelnou samostatnou stupnici od −3000 do
  +3000 FT/MIN s fyzickým ukazatelem směru a hodnotou.
- Malé obrazovky používají vodorovně posuvný SVG displej
  o minimální šířce 760 px, takže se důležité značky
  nezmenší na nečitelné hodnoty.
- Zachována potvrzená znaménka **kladné klopení MSFS =
  příď dolů** a **kladný náklon MSFS = levé křídlo dolů**.
  PFD nemění původní SimConnect data ani frekvenci 30/20 Hz.

Při ověření doporučujeme pozorovat zejména IAS 0,
výšku kolem 1168 FT, kurz 326°, průchod 359/0°,
klesání/stoupání a pravý/levý náklon.

## Frekvence a neplatná data

SimConnect odebírá přibližně 30 Hz při MSFS zamčeném na 30 FPS;
bridge předává nejvýše 20 unikátních snímků za sekundu.
PFD používá `requestAnimationFrame` s exponenciálním
vyhlazením mezi přijatými vzorky. Cílem je přirozený pohyb
na displejích s obnovovací frekvencí 60 Hz, nikoli zvýšení
skutečné frekvence nebo interpolace telemetrie na serveru.

Při odpojení nebo příliš starých snímcích se přístroj zakryje
oznámením **ŽÁDNÁ ŽIVÁ TELEMETRIE**. Nikdy nesmí vydávat
mock data nebo starý vzorek za skutečný let bez označení.

## Ověření

1. V MSFS spusťte let na XCub/Cessna.
2. Otevřete `/pfd` z Macu nebo tabletu.
3. Ověřte, že při přitažení řízení se horizont posune dolů.
4. Levý a pravý náklon porovnejte s umělým horizontem v kokpitu.
5. Plynule přetočte kurz přes sever a sledujte, že se páska
   neprotočí o 358 stupňů.
6. Pozastavte nebo ukončete MSFS a ověřte označení neplatných dat.

Přístroj je **pouze vývojová pomůcka pro simulátor**, není
certifikovanou avionikou. Rozšířený HSI, klapky a autopilot
jsou plánované pro samostatné etapy.
