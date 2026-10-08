# C31 V2 – technický snapshot pro reálnou validaci MSFS 2020

Stránka `/validation` obsahuje ruční scénáře pro C172/G1000, XCub Floats,
TBM930, avioniku, navigaci a AI traffic. **Nejde o automatické potvrzení
kompatibility**, o výsledku stále rozhoduje pilot s běžícím MSFS 2020.

## Zachycení důkazů na kliknutí

Tlačítko **Zachytit technická data** při živém SimConnectu odešle tři
lokální read-only požadavky na již existující API:

- `GET /api/status` – režim a stáří/frekvence telemetrie;
- `GET /api/aircraft/systems` – dostupnost a vybrané systémové SimVars;
- `GET /api/navigation/current` – dostupnost GPS, počet/index waypointů a
  vzdálenost aktivního bodu.

Během zachycení se **neposílají žádné příkazy do simulátoru** a nevytváří se
další SimConnect subscription. Browser čeká nanejvýš 5 sekund a pak přizná
chybu; při změně letadla se starý snímek zneplatní. Žádný snapshot nevznikne
samovolně ani v mock režimu.

Do exportovaného JSON se ukládají jen vyjmenované povolené hodnoty.
Surové odpovědi z API se neexportují, **polohy, souřadnice waypointů,
letová historie ani chybové řetězce** nejsou v technickém důkazu.
Uživatelské poznámky však mohou obsahovat osobní údaje a je nutné je
před sdílením zkontrolovat. Export se stahuje výhradně do prohlížeče.

## Ověření

Node regresní testy potvrzují allowlist, odstranění GPS/metadat a
vyloučení mock/offline či neplatných čísel. Browser build musí projít v CI.

Tento export výrazně usnadňuje porovnání telemetrie, ale **nemůže nahradit
praktické ověření MSFS**. Zejména funkčnost Input Events, AI provozu a
přistání na vodě musí pilot potvrdit na skutečných letadlech.
