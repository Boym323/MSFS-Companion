# C5 – profily letadel

Bridge poskytuje `GET /api/aircraft/profile`. S využitím živého
`TelemetrySnapshot.Aircraft` vybírá **kandidátní** profil dle TITLE, neprovádí
automatickou certifikaci schopností. Pokud MSFS není připojen, je
`connected=false` a `profile=null`. Profil nikdy nesmí automaticky
povolovat příkazy – dostupnost Input Events se musí samostatně enumerovat.

Připravené detektory: C172, XCub, NXCub, TBM930, DA40, DA62,
Bonanza G36, C208, Airbus, jinak obecný profil. Překryvy názvů
mají pořadí pravidel; generický fallback neblokuje dosavadní PFD.

K ověření: C172 s G1000 i analog, XCub Floats, NXCub, TBM930.
Prohlédněte TITLE, skutečné přístroje a enumerované Input Events.
Změna letadla se má projevit v profilu při dalším živém snímku.
