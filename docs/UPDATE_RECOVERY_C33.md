# C33 – první bezpečnostní vrstva aktualizací (zatím bez automatického rollbacku)

Před předáním stažené aktualizace Velopacku zapisuje Windows hostitel
atomický lokální soubor `pending-update.json`. Pokud jej nelze vytvořit,
aktualizace se nespustí. Po restartu aplikace se provede až 10 pokusů
o získání místních stránek `/api/health/overview` a `/admin`,
každý s krátkým timeoutem. Dokud kontrola probíhá, nejsou spouštěné nové
aktualizace. Úspěch vymaže pending záznam, neúspěch jej přesune na
`failed-update.json`, vypne automatické aktualizace a zapíše upozornění.

**Nejde o skutečný automatický rollback**. Pokud nový Windows hostitel vůbec
nenastartuje, kód uvnitř něj nemůže obnovit předchozí verzi. K úplnému C33
je nutný nezávislý externí watcher, uchování instalovatelného balíčku známé
funkční verze, ověření obnovy i po úplném pádu aplikace a reálné testování
na Windows. Bez toho automatické obnovení předchozího vydání nezapínejte.

Záměrně se nikdy neukončuje FlightSimulator.exe, nemažou se letové záznamy
ani se nevyžaduje další Windows aplikace. Self-test pouze ověřuje validaci
journal záznamu; kompletní aktualizaci CI bez instalace neověří.
