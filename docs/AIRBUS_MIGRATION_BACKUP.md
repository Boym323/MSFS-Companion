# Záloha MSFS Companion před přechodem na Airbus-only

Zálohování je **ruční a pouze lokální**. Tento skript nikdy nemaže ani neobnovuje data.
Použijte PowerShell 7 na Windows PC po ukončení simulátoru a Companion.

1. Vyberte privátní cílové místo mimo původní adresář (ideálně externí disk).
2. V kořeni repozitáře spusťte kontrolní režim:
   `./scripts/backup-airbus-migration.ps1 -Destination 'D:\Zalohy'`
3. Po kontrole spusťte vytvoření zálohy:
   `./scripts/backup-airbus-migration.ps1 -Destination 'D:\Zalohy' -Execute`
4. Skript vytvoří nový unikátní adresář obsahující úplnou kopii
   `%LOCALAPPDATA%\MSFS Companion` včetně settings.json, flights a journalů.
   Každý soubor porovná SHA256 a uloží manifest-sha256.json.
5. Zálohy obsahují citlivé GPS trasy; **nepublikujte je na GitHubu**.
6. Odložte rovněž poslední funkční Setup.exe v0.2.193 a zaznamenejte commit.
7. Uživatelské preference a checklisty v localStorage iPadu/Macu
   zůstávají samostatně v zařízení; exportujte pouze ne-citlivé hodnoty,
   nikoli cookies, celé sessionStorage nebo párovací tokeny.

Obnova se musí ověřit na oddělené testovací instalaci. Skript záměrně
nenabízí automatickou obnovu a odmítá přítomnost reparse pointů.
Test v CI používá jen syntetická data, nikdy nepřistupuje k uživatelským záznamům.
