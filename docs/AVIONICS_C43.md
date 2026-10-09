# C43 – ruční kompatibilita avioniky podle aktuálního letadla

Na stránce `/g1000` lze nyní vybrat jen skutečně enumerovaný
Input Event a ručně zaznamenat zda došlo k očekávané změně
na displeji letadla. Evidujeme `pass` nebo `fail`, žádný automatický
PASS neodvozujeme z odeslaného příkazu, HTTP ani SimConnect enumerace.

Evidence jsou lokální v prohlížeči, oddělené podle přesného
`TITLE` letadla a konkrétního ID povoleného ovladače. Načtené záznamy
jsou omezené, validované a po 90 dnech přestanou platit. Nesouvisející
ovladač ani neznámý Input Event nelze ručně označit, není-li živý MSFS.
Po přepnutí letadla se načtou jiné záznamy, žádný příkaz se nevykoná
bez výslovného kliknutí a současného existujícího allowlistu.

Tato vrstva nesimuluje skutečný readback událostí bez dostupných SimVars.
Pro konkrétní podporu G1000/G3000 je i nadále nutná praktická zkouška
MSFS 2020 podle issues #23 a #20. Lze využít /validation (C41)
pro porovnání reálných měřitelných SimVars před a po ovládání.
