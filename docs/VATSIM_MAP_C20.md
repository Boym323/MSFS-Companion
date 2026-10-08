# C20 – dobrovolná vrstva VATSIM na mapě

Na stránce `/map` lze zaškrtnout **VATSIM online letadla**. Ve výchozím
stavu je vrstva vypnutá. Po aktivaci se nad mapou MSFS zobrazují
růžové značky (volací znak při zoom ≥ 10). VATSIM provoz není AI
provoz z MSFS; letadla tedy nemusejí být vidět ve scéně simulátoru.
Na iPadu ani Windows se neinstaluje žádný další program.

Implementace využívá již existující C16 backend API
`/api/vatsim/nearby`, nikoli vlastní připojení k VATSIM nebo jeho
hlasové síti. Vybírá nejvýše 80 pilotů v okruhu 30–300 km
podle měřítka mapy. HTTP opakuje po 35 sekundách. Souřadnice
se pro dotaz zaokrouhlují na 0,1°, takže 20Hz telemetrie
nevytváří nepřetržitou síťovou zátěž.
Pozice v odpovědi procházejí validací a značka se vykreslí
pouze v oblasti viditelné mapy.

Stav `available/stale/error/updatedAt` je zobrazen nad mapou.
Pokud feed VATSIM není dostupný, podklad OpenStreetMap, trasa,
letiště, přístroje ani ovládání MSFS nejsou ovlivněny.

Regresní Node testy kontrolují limit okruhu a počtu pilotů,
platnost souřadnic a kvantování dotazů. Reálné zobrazení
VATSIM pilotů na domácím Windows/iPadu je nutné ověřit
prakticky; bez pilotů v okolí může být mapa správně prázdná.

Zdroj dat: https://vatsim.dev/api/data-api/get-network-data/
