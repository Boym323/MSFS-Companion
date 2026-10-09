# C42 – příprava nezávislé obnovy Windows (read-only metadata)

Zkušenost s předchozími vydáními ukázala, že čistá instalace
a health + web smoke nejsou totéž jako obnovení verze po pádu
aktualizovaného procesu. Automatický rollback proto dál **není zapnutý**.

C42 etapa 1 rozšiřuje lokální atomický `pending-update.json`
o `Schema=2` a `PreviousVersion`. Před přenecháním instalace Velopacku
se do journalu zapíše předchozí nainstalovaná verze (pokud ji Velopack
dokáže skutečně zjistit), zamýšlená nová verze a čas zahájení.
Pokud není předchozí verze zjistitelná, zůstává legacy schema 1
a **nelze tvrdit, že existuje rollback candidate**. Pokud je verze
neplatná nebo stejná jako cílová, update se pozastaví.

Až **po ověření nové instalované verze a úspěšném HTTP + web smoke**
vzniká atomicky `last-verified-update.json` s verzí a časem potvrzení.
Starý journal typu 1 je nadále čitelný; poškozená schema 2 data
zůstávají fail-closed. Lokální Windows `--self-test` ověřuje
starý i nový formát, výměnu/nesoulad verzí a časové limity.

Tato evidence **není samotná binární záloha** a není způsobilá
k obnově aplikace. Zbývá (issue #19):
nezávislý watchdog, instalační balíček poslední funkční verze,
oddělené ověření podpisu/hash balíčku, skutečný rollback a test
pádu i nemožnosti spuštění na Windows. Bez jejich dokončení nesmí
Kokpit tvrdit, že aktualizace automaticky vrací předchozí verzi.
