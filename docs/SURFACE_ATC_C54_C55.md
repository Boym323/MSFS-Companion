# C54–C55 · Letištní detail a VATSIM ATC

C54: přímo na mapě je tlačítko **Detail pojíždění** (pouze při potvrzené poloze).
Vynutí orientační zoom alespoň 14 a jednorázově si na výslovné kliknutí
vyžádá komunitní OSM pojezdové dráhy a vyčkávací pozice přes existující
Overpass dotaz. Opětovné kliknutí vypne letištní režim a obnoví původní zoom.
Data nejsou skutečná clearance ATC, informace o letištní databázi MSFS
ani garantovaná navigace. Bez internetu nebo bez GPS není dostupná.

C55: Smart Radio nyní odděleně ukazuje letištní frekvence z katalogu OurAirports
a **skutečně online stanoviště VATSIM** z již používaného, cacheovaného bridge API.
Neověřené nebo staré údaje se nesmí nabídnout k ladění. Před nastavením COM1
standby se frekvence validuje existujícím COM allowlistem. Příkaz je pouze
na samostatný klik uživatele s platným stávajícím oprávněním, nikdy automaticky
a nikdy přímo do COM1 active. VATSIM Center odkazuje na správné letiště.

CI a Visual UI: mapa offline musí zakázat Surface, ATC karta se musí oddělit
od statického katalogu; skutečný MSFS a fyzické iPad zařízení zatím neověřeny.
