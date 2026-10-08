# C26 – MSFS Traffic Awareness (experimentální, pouze čtení)

Na `/map` je nová samostatná vrstva **Letadla z MSFS** – zelené značky.
Vrstva je standardně vypnutá a nijak neovlivňuje VATSIM (růžové značky).

## Technika

Windows bridge používá **vlastní, oddělené read-only SimConnect spojení**:
- `SimConnect_RequestDataOnSimObjectType` s typem AIRCRAFT, 100 km kolem letadla;
- vlastní definice šesti běžných FLOAT64 SimVars: GPS, výška, kurz, GS a on-ground;
- bounded 8s dotazování, nejvýše 100 vrácených objektů, kontrola request IDs,
  velikosti paketů a rozsahu poloh;
- vlastní P/Invoke ke *stejnému SimConnect.dll*, který MSFS poskytuje – nejde o
  další instalaci softwaru ani změnu verzí existujícího NuGet balíčku.

Díky samostatnému spojení nemůže výpadek traffic čtečky zastavit základní
20Hz přenos telemetrie. **Čtečka se aktivuje až po výslovném zapnutí vrstvy**;
po 35 sekundách bez klientského zájmu se automaticky zastaví.

## Kvalita

Odpověď `GET /api/traffic/nearby` je read-only. Pokud MSFS nevrátil kompletní
validní sadu objektů, API má `available=false` a neukazuje umělé „0 okolních
letadel“. Snímky starší než 25s se skryjí. V režimu mock neexistují žádné
smyšlené traffic objekty. SimConnect vrací vlastní interní identifikátory,
nikoliv spolehlivé volací znaky; proto UI zobrazuje `AI #ID` a pozici.

`RequestDataOnSimObjectType` nemusí zahrnovat všechna multiplayerová letadla
ani provoz některých addonů. Nejde o radarový TCAS nebo bezpečnostní systém.
Zejména je potřeba test na Windows/MSFS 2020 – C172 s aktivním AI provozem,
více letadel do 100 km, odpojení/reconnect, přepnutí typu letadla a vypnutí
vrstvy. GitHub CI ověřuje konstrukci dat a odolnost parseru, **nikoliv samotný
nativní MSFS SimConnect traffic**, který na GitHub runneru není dostupný.

Nebyly přidány žádné write/AI-create API a žádný externí Windows proces.
