# C16 – VATSIM Center

Stránka `/vatsim` čte oficiální feed `https://data.vatsim.net/v3/vatsim-data.json`
přímo prostřednictvím Windows bridge. Žádný VATSIM klient, ovladač,
login ani další software není nutný. Zdroj poskytuje online piloty a
ATC stanoviště, jejich volací znaky a zveřejněné frekvence.

Backend načítá feed nejvýše jednou za 30 sekund, omezuje odpověď
na 12 MB, používá HTTPS, timeout 12 s, 45sekundový backoff při chybě
a publikuje pouze nezbytné údaje bez identifikačních čísel a jmen
uživatelů. Ve výsledku nejvýše 80 pilotů v okruhu 10–500 km
a 35 ATC stanovišť se zvoleným prefixem ICAO.

Přehled pilotů ukazuje polohu online na VATSIM; neznamená to,
že je daný provoz **také načtený uvnitř MSFS 2020**.
Stanoviště s jiným prefixem volacího znaku nemusí být filtrem zachyceno.
Nelze zde vést hlasové spojení a frekvence se automaticky nezapisují do rádia.

V offline režimu vrací pouze poslední úspěšně získaná data označená
jako starší. Všechny ostatní instrumenty zůstávají nezávislé.
