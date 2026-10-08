# C17 – další nativní ovladače G1000

MSFS Companion rozšiřuje panel `/g1000` o **Flight Plan, Procedures, Enter, CDI, OBS a Range** pro PFD i MFD. Jde o běžné kandidátní názvy SimConnect Input Events. Tlačítka jsou dostupná jen tehdy, když MSFS danou událost skutečně zveřejní při enumeraci aktuálního letadla. Provoz přes SimConnect nevyžaduje MobiFlight Connector, WASM ani jinou nainstalovanou aplikaci.

Katalog má pevně dané identifikátory a hodnoty: u tlačítek impuls 1, u otočných ovladačů ±1. Neznámé události, nepovolené hodnoty a kokpity bez dané funkce zůstávají zablokované. Úspěšná HTTP odpověď znamená pouze **odesláno**, nikoli potvrzenou změnu v MSFS.

Při prvním skutečném testu porovnat C172 G1000 a dostupné addony. Názvy Input Events se mohou u variant lišit.
