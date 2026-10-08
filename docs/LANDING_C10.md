# C10 – přistávací analytika

MSFS 2020 poskytuje `PLANE TOUCHDOWN NORMAL VELOCITY` v **ft/s**
a `G FORCE`. Bridge čte obě přes oddělenou 1Hz SimConnect
subscription a převádí ft/s na ft/min (záporné znaménko pro dosednutí).
Kontakty se zemí se detekují při přechodu hodnoty `SIM ON GROUND`
z false na true; po restartu se stav vymaže.

Flight Recorder do **nových** JSONL záznamů volitelně doplňuje
`touchdownRateFpm` a `gForce`. Staré záznamy nemají tyto hodnoty,
proto web místo nuly zobrazí „—“. Frontend hodnoty přiřazuje pouze
potvrzeným událostem dosednutí. Zobrazuje je na `/flights`.
Nový diagnostický endpoint je `GET /api/landings/latest`.

**Omezení:** odběr 1 Hz může minout krátký odskok, nedokáže změřit
maximální přetížení přesně v okamžiku dotyku a nehodnotí „kvalitu pilota“.
G-force z uloženého vzorku je orientační okamžitá hodnota. Pokud avionika
neposkytuje platné SimVars, nevypočítává se falešná touchdown rate
z údaje VSI. Nejde o certifikované měření.

Před označením výsledků za ověřené je nutný test více přistání v MSFS
2020 s C172/XCub a porovnání s údajem hry. Reálné testy zatím nebyly možné.
