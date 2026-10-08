# B4 – pohyblivá mapa

## Použití

Z Macu nebo tabletu otevřete `http://IP_WINDOWS_PC:8765/map`
ve stejné domácí podsíti jako Windows s MSFS 2020.

Mapa používá aktuální zeměpisnou šířku a délku z již
existujícího SimConnect spojení. **Není nutný další odběr**
ani žádné ovládací příkazy. Letadlo zůstává uprostřed
zobrazení, sever je vždy nahoře a symbol se natáčí podle
magnetického kurzu. Tlačítky +/− lze změnit přiblížení.

### Podklad a ochrana soukromí

Výchozí režim zobrazuje vlastní souřadnicovou mřížku,
letadlo a stopu. **Je použitelný i bez internetu.**

Při výslovném zapnutí volby **Zobrazit podklad OpenStreetMap**
stahuje prohlížeč mapové dlaždice z
`https://tile.openstreetmap.org`. Třetí strana tak může
poznat přibližnou zobrazovanou oblast a veřejnou IP adresu
prohlížeče. Uživatel má kdykoli možnost podklad vypnout.

Zobrazujeme povinné © OpenStreetMap přispěvatelé.
Neodesíláme letové body ani identifikaci letadla žádnému
dalšímu serveru Companionu.

### Stopa letu

Během otevření stránky se zaznamená nejvýše 1 GPS bod za
sekundu, maximálně **3600 bodů**. Při změně typu letadla
nebo nepřirozeném přesunu o více než 100 km se stará stopa
vyčistí, aby nevznikala chybná spojnice. Body lze odstranit
tlačítkem **Smazat stopu**.

**Stopa zatím není trvale uložená**: po obnovení stránky
zmizí. Historii letů doplní etapa B5 (Flight Recorder).
Při odpojení MSFS se mapa označí jako offline a přestane
předstírat novou polohu.

## Ověření

1. Na Windows spusťte MSFS a načtěte let.
2. Otevřete `/map` z Macu a ověřte polohu proti simulátoru.
3. Vyznačená stopa se musí prodlužovat přibližně 1× za sekundu.
4. Změňte kurz, přibližujte a oddalujte mapu.
5. Bez internetu musí zůstat dostupná mřížka a vlastní stopa.
6. Zapnutí OSM podkladu vyžaduje internet; ověřte uvedené
   licenční označení.
7. Po odpojení MSFS musí zmizet symbol aktuální polohy.

Web je pouze informační doplněk ke **simulátoru**, nikoliv
certifikovaná navigace.
