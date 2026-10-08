# Vlna 3 – C27 / C28 / C29

Veškeré funkce jsou součástí MSFS Companion bez instalace další aplikace.

## C27 Smart Radio Assistant
`/radio-assistant`: načte frekvence letiště z již existujícího
OurAirports katalogu. Hodnoty COM se před zobrazením tlačítka kontrolují
v rozsahu 118–136.990 MHz a 5kHz kroku, stejně jako backend allowlist.
Ovládání vyžaduje existující kontrolu přístupu z C1/C2 a potvrzení
každým **kliknutím pilota**. Pouze COM1 standby, žádné automatické SWAP
ani odeslání příkazu bez akce uživatele. Odeslaný příkaz neznamená
potvrzené přeladění – ověření podle readback stavu COM1.

## C28 Flight Replay
`/flights` má synchronní kurzor do existující mapy i čtyř grafů
(ALT, IAS, VS, náklon), možnost přehrát 1/2/4 záznamové vzorky za
sekundu, což není přesná simulace reálného času při chybějících vzorcích.
Grafy vykreslují nejvýše přibližně 600 bodů a při dlouhých letech
nepoužívají nebezpečné velké `Math.min(...values)` seznamy. Replay
nikdy neposílá ovládání do MSFS.

## C29 Aircraft Checklists
`/checklists` zvolí šablonu podle TITLE (C172, TBM930 či obecné).
Všechny body lze ručně odškrtávat; pilot může doplnit nejvýše 25
vlastních kroků v každé fázi a resetovat svůj stav. Uloženo pouze
v lokálním prohlížeči, oddělené podle profilu a fáze.
Obsah je **pomůcka pro simulátor**, ne oficiální checklist výrobce;
je nutné používat POH konkrétního letadla. Neexistuje automatická
kontrola neověřených přepínačů ani automatické ovládání.

Testy: Node pro COM rozsahy, omezení grafů a sanitizaci checklistu,
plus existující frontend build.
