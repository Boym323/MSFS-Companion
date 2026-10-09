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

## C49 V3.1 – skutečná lokální obnova do recorderu

Je-li stránka otevřená **přímo na Windows PC přes
`http://127.0.0.1:8765/flights`**, lze po kontrole JSON souboru
zatrhnout výslovný souhlas a zahájit obnovu. Backend POST
`/api/flights/restore` striktně vyžaduje **loopback** klienta,
shodný Origin a hlavičku `X-MSFS-Companion-Action: restore-flights`.
Běžný tablet v LAN nemá právo zapisovat letovou historii.

Archiv se kontroluje na straně serveru podruhé: pevné schema,
maximálně 30 letů, 4 000 validních a časově seřazených bodů
na let, plně uzavřená relace a maximální payload 20 MB.
Během aktivního nahrávání se obnova odmítne. Staré záznamy
se nepřepisují: nové dostanou náhodné identifikátory,
metadata se zapisují až po těle letu a při I/O chybě se
**nově vytvořené** soubory odstraní. Před zápisem se ověřují
celkové limity 30 letů a 100 MiB. Obnova nevypíná ani
nezmění nastavení MSFS; probíhá pouze s lokální historií.

Import neobnovuje přesně původní frekvenci raw záznamu (export
používá již převzorkované API body), nahradí původní ID novým
a **neobchází** běžnou pozdější retenční politiku recorderu.
