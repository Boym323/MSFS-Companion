# C14 – letištní vyhledávání

Na mapě lze vyhledávat letiště podle ICAO či názvu z již stažené databáze OurAirports. Vyhledávání probíhá v samotném Windows bridge, bez další instalace, externího API a síťového dotazu při každém znaku. Výsledek je omezen na 25 letišť, klient používá prodlevu 350 ms.

Endpoint `GET /api/map/aviation/search?q=LKPR` vrací výsledky nebo prázdný seznam do stažení databáze. Detail drah a frekvencí z C8 zůstává zachovaný. Nejde o certifikovanou databázi pro skutečný let.
