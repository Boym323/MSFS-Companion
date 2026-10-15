# B4 – pohyblivá mapa

## Použití

Z Macu nebo tabletu otevřete `http://IP_WINDOWS_PC:8765/map`
ve stejné domácí podsíti jako Windows s MSFS 2020.

Mapa používá aktuální zeměpisnou šířku a délku z již
existujícího SimConnect spojení. **Není nutný další odběr**
ani žádné ovládací příkazy. Letadlo zůstává uprostřed
zobrazení, sever je vždy nahoře a symbol se natáčí podle
magnetického kurzu. Tlačítka **+ / − jsou přímo v levém horním rohu mapy** a mění zoom 6–15.\nČíselná úroveň přiblížení se zobrazuje mezi tlačítky.\nPod mapou jsou GPS údaje, délka stopy a tlačítko **Smazat stopu**.\nDoplňkové vrstvy (počasí, provoz, letiště, vzdušné prostory,\npojezdové cesty) i import letového plánu jsou seskupené v\nrozbalovací sekci **Vrstvy a nastavení mapy**. Mapa je vidět ihned\npo otevření stránky bez procházení dlouhého bloku přepínačů.

### Podklad a ochrana soukromí

OpenStreetMap se na stránce **/map načítá automaticky** při
známé GPS poloze a dostupném internetu. I bez internetu
zůstává funkční vlastní mřížka, symbol letadla a trasa.

Podkladové dlaždice pro aktuálně viditelnou oblast stahuje přímo
webový prohlížeč z `https://tile.openstreetmap.org`.
Poskytovatel tak může poznat přibližnou zobrazovanou oblast,
veřejnou IP adresu klienta a původ webové stránky; **neodesíláme
mu celý záznam GPS bodů ani identifikaci letadla**. Přispěvatelům
OpenStreetMap zůstává viditelná atribuce. Na stránkách /map
a /flights je společná volba vypnutí podkladu uložená v prohlížeči.
Při prvním otevření je zapnutá.

Na rozdíl od staré verze není pro OSM blokován HTTP Referer:
server OSM jej vyžaduje podle pravidel používání dlaždic.
Používá se normální vyrovnávací paměť prohlížeče, bez stahování
dlaždic pro neviditelné oblasti nebo do offline archivu.
Podmínky: https://operations.osmfoundation.org/policies/tiles/

### Stopa letu

Během otevření stránky se zaznamená nejvýše 1 GPS bod za
sekundu, maximálně **3600 bodů**. Při změně typu letadla
nebo nepřirozeném přesunu o více než 100 km se stará stopa
vyčistí, aby nevznikala chybná spojnice. Body lze odstranit
tlačítkem **Smazat stopu**.

Živá stopa na stránce /map se neukládá: po obnovení stránky
zmizí. Samostatný Flight Recorder B5 uchovává historii letů
na Windows PC a zobrazuje ji na podkladové mapě v /flights.
Při odpojení MSFS se mapa označí jako offline a přestane
předstírat novou polohu.

## Výkonnost vykreslování stopy

Při každém novém bodu nebo změně zoomu se vytvoří relativní SVG
geometrie trasy. Samotné průběžné centrování mapy posouvá již připravenou
geometrii pomocí SVG transformace; nepřepočítává všech 3 600 bodů
při každém 20Hz snímku telemetrie. Délka stopy se přepočítává
pouze při změně bodů. Segmenty přes ±180° používají nejkratší
zeměpisný přechod. Zůstávají zachovány dosavadní limity, export
záznamů i stav při odpojení simulátoru. Přínos na konkrétním
iPadu je nutné ověřit provozním měřením FPS a paměti.


## Ověření

1. Na Windows spusťte MSFS a načtěte let.
2. Otevřete `/map` z Macu a ověřte polohu proti simulátoru.
3. Vyznačená stopa se musí prodlužovat přibližně 1× za sekundu.
4. Změňte kurz, přibližujte a oddalujte mapu tlačítky přímo na mapě.\n   Ověřte hranice zoomu 6–15 a to, že ovládání zůstává viditelné na iPadu i mobilu.\n   Rozbalte nastavení vrstev a ověřte, že nevyvolá horizontální posouvání.
5. Bez internetu musí zůstat dostupná mřížka a vlastní stopa.
6. OSM podklad musí být automaticky zapnutý; ověřte atribuci,
   dostupnost bez internetu i možnost jej vypnout a opět zapnout.
7. Po odpojení MSFS musí zmizet symbol aktuální polohy.

Web je pouze informační doplněk ke **simulátoru**, nikoliv
certifikovaná navigace.
