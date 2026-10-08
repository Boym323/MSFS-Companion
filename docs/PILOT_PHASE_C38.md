# C38 – doplnění skutečné 1Hz fáze letu

Rychlý 20Hz WebSocket nenese `onGround` ani `altitudeAglFeet`.
Tyto hodnoty jsou již dostupné prostřednictvím odděleného read-only
endpointu `GET /api/aircraft/systems`, který čte existující 1Hz SimConnect
odběr. Stránka `/pilot` nyní pouze při připojeném skutečném MSFS vyžádá
stav každé 2 sekundy, kontroluje `mode=simconnect`, věk do 5 sekund,
rozsahy hodnot a identitu typu letadla ve chvíli vyžádání. Po přepnutí
letadla se vzorek invaliduje, při chybě zůstává fáze neznámá.

Žádná nová SimConnect subscription, automatické povely ani neověřený
odhad kontaktu se zemí nejsou přidány. Pro reálné potvrzení fáze letu
musí proběhnout test v MSFS 2020 (C172, XCub Floats – voda).
