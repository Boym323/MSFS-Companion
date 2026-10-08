# C19 – stabilita NOAA METAR a TAF

Navazuje na C15 a používá pouze vestavěný Windows bridge a veřejné HTTPS API NOAA.

Změny:
- METAR a TAF se obnovují nezávisle: výpadek druhého dotazu nesmaže nově získaný první report.
- Když se některý report nepodaří aktualizovat, zachovají se poslední platná data, odpověď však uvádí `stale: true` a vysvětlení `error`.
- Při částečném nebo úplném výpadku se příliš staré datum `fetchedAt` nevydává za právě obnovené.
- Status **HTTP 204** z NOAA je skutečně platná odpověď bez aktuálního METAR či TAF a nevrací starý report jako nový.
- HTTP 404, 429, 500 aj. jsou považovány za chybu, nikoli za nepřítomnost počasí.
- Opakování neúspěšného dotazu nejdříve po dvou minutách; úspěšná data v cache 10 minut.
- Velikost odpovědi je tvrdě omezena na 8192 bytů i u tzv. chunked transferu bez `Content-Length`.
- Při zrušení požadavku klientem se řetězec korektně zruší místo publikování pseudoúspěšného výsledku.
- UI zobrazuje výslovné upozornění na stará či částečná data.

Ověření: deterministické .NET testy kombinace neúplných reportů,
nulového obsahu HTTP 204, časů cache a validace ICAO. Otevření
skutečného NOAA serveru na cílovém Windows počítači není garantováno CI.

Oficiální zdroj: https://aviationweather.gov/data/api/
