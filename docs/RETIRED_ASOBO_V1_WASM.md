# Původní Asobo A320neo V1 a WASM: odstranění ze zdrojů

Historické FCU/MCDU a WASM H-event transport původního Asobo A320neo V1
jsou odstraněny z webu, backendu, 1Hz SimConnect odběrů, instalačního balíčku,
tray menu a SDK CI. Staré API cesty vracejí HTTP 410 Gone.
Pro Airbus zůstávají společné PFD, mapa, radio, SimBrief a zabezpečené
identifikační mechanismy. Integrace FlyByWire A32NX je v samostatném PR #144;
funkční FMS iniBuilds V2 dosud nebylo ověřeno.

Uložené rozvržení s panelem `a320` se bezpečně normalizuje na
PFD/mapu a **uložená data se nemažou**. Stará webová cesta `/a320`
zobrazí vysvětlení odstranění, ne nefunkční přístroj.

## Pokud již byl původní WASM nainstalován

Návrh **neodinstalovává nic z MSFS Community**. Starý modul
`kokpit-asobo-a320-v1` může v Community zůstat z dřívějšího vydání.
Po ukončení MSFS i Companion ručně otevřete přesně tu Community složku,
kterou jste dříve pro tento modul schválili. Nejdříve přesuňte **pouze**
adresář `kokpit-asobo-a320-v1` mimo Community jako zálohu a ověřte,
že neobsahuje uživatelské soubory. Cizí Community doplňky nemažte.
Uživatel musí skutečné odstranění schválit samostatně.

Zachování simulátoru: hlavní `SimConnectTelemetrySource` a jeho
20Hz publisher, radio, systems, navigation, landing events, flight records,
autopilot guard a LAN zabezpečení zůstávají.

Roll back: vrátit ověřený předchozí release a kopii soukromého profilu
po ručně ověřené migrační záloze. V provozním MSFS otestovat A32NX a
iniBuilds V2, než vznikne produkční vydání.
