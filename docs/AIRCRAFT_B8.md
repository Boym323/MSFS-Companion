# B8 – ověření kompatibility letadel

Na stránce `/aircraft` je nově **Diagnostika SimVars B8**. Zobrazuje
přijaté skupiny systémových veličin, případné neplatné hodnoty a umožní
exportovat JSON pro diagnostiku. Výsledek `Přijato` **neznamená**
„podporováno“: například 0 RPM, 0 paliva nebo vypnutý autopilot mohou
být pravdivou hodnotou i výchozí nulou nepodporované SimVar.

Export neobsahuje GPS souřadnice, ale obsahuje název letadla a přijaté
systémové veličiny. Data se ukládají pouze stažením na zařízení, odkud
uživatel export spustil.

## Manuální ověření přímo v MSFS 2020

1. Na Windows načtěte `Asobo XCub Floats`, v prohlížeči otevřete
   `http://IP_WINDOWS_PC:8765/aircraft`, ověřte živý zdroj SimConnect.
2. Na zemi zaznamenejte tachometr, stav motoru, množství paliva,
   polohu klapek a případný stav podvozku; přepněte každý dostupný
   ovladač a ověřte, že dashboard sleduje změnu. Plováky nejsou
   automaticky považovány za zatahovací podvozek.
3. Po vzletu porovnejte IAS, TAS, GS, výšku AGL a směr/rychlost větru
   s MSFS (kde je daný údaj v kokpitu dostupný).
4. Je-li autopilot přítomen, ověřte zapnutí, požadovaný kurz, výšku
   a vertikální rychlost. U letadel bez autopilota jsou AP SimVars
   pouze orientační.
5. Stáhněte anonymizovaný report B8 a poznamenejte odchylky.
6. Stejné kroky zopakujte s C172 a případně A320; nikde neoznačujte
   profil za definitivně kompatibilní bez reálného porovnání.

V žádné etapě se neodesílají povely do MSFS. Automatické testy ověřují
pouze diagnostickou logiku a nedokážou simulovat chování konkrétního
letadla.
