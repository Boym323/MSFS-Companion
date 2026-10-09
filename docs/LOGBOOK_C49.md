# C49 – přenosná záloha letového deníku V3 (první část)

Na `/flights` je nově uživatelsky vyvolávaný export do jednoho
`kokpit-zaloha-letu-YYYY-MM-DD.json` pro všechny momentálně
dostupné lety (nejvýše 30). Čte stávající rozhraní
`GET /api/flights` a `GET /api/flights/{id}` sekvenčně,
maximálně 10 sekund na let. Bez nových backendových procesů.

Formát má pevné schéma `kokpit-flight-backup-v1`, čas exportu,
jednoznačné ID letů, stav aktivní/testovací a dostupné vzorky telemetrie.
Záloha je omezená na 20 MB a nejvýše 10 000 bodů na let,
nesoulad nebo neplatné položky export zastaví, nikoliv tiše odstraní.
Historický bridge může dlouhé lety při čtení převzorkovat na max.
4 000 bodů; proto **nejde o archiv raw JSONL v plné původní frekvenci**.

Na stejné obrazovce lze existující JSON **lokálně ověřit a
zobrazit souhrn**, ale soubor se nezapisuje zpět do historie bridge.
Obnova Windows diskových záznamů do produkce vyžaduje
samostatný bezpečný import s kontrolou souběhu aktivního recorderu,
licencí a integritních limitů – neaktivujeme jej bez testu.

Zálohy obsahují **GPS souřadnice a časovou historii letu** a
nesmí být bez souhlasu pilota zveřejňovány. Vše se provádí v
prohlížeči, neodesílá se do cloudu. Stávající retenční limit
Windows recorderu (30 letů / 100 MiB) se nemění a starší smazané
záznamy již nelze exportovat.
