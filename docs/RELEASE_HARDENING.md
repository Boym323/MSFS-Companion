# B11 – příprava podpisu vydání a obnova předchozí verze

## Podepisování Windows

Workflow `.github/workflows/windows-installer.yml` přijímá **volitelný**
GitHub Actions secret `WINDOWS_SIGN_PARAMS` s argumenty pro
`signtool.exe` předávanými přes `vpk pack --signParams`.
Pokud chybí, vzniká **nepodepsané vývojové vydání** a job to
výslovně hlásí. Pokud je nastaven, CI po zabalení vyžaduje
platný Authenticode podpis `Setup.exe`; jinak job selže a
vydání se nepublikuje.

Toto **neinstaluje certifikát** do build runneru. Správce musí
zajistit code-signing certifikát / podporovanou podpisovou službu
a její bezpečné zpřístupnění na Windows runneru. Žádný soukromý
klíč ani PFX se nesmí commitovat. Pro Azure Artifact Signing je
potřeba samostatná konfigurace identity a služby. Bez toho se
výsledná vydání nesmějí prezentovat jako podepsaná.

Referenční návod: https://docs.velopack.io/packaging/signing

## Obnova při problémové aktualizaci

Velopack ověřuje hash staženého balíčku a Windows build prochází
smoke testy. **Není implementovaný automatický rollback při
neúspěšném spuštění po aktualizaci.** Nelze jej nahrazovat
prostým restartem hostitele a tvrdit, že jde o rollback.

Postup manuální obnovy:
1. Zavřete Companion, samotný MSFS není nutné ukončovat.
2. Zálohujte data z `%LOCALAPPDATA%\MSFS Companion\flights`
   a soubor `settings.json`.
3. Aby se vadná verze znovu nenainstalovala, vypněte
   `AutomaticUpdates` v nastavení Companionu, pokud ještě běží;
   alternativně po zavření upravte toto pole v zálohovaném
   `settings.json` na `false` a ověřte validitu JSON.
4. Vyberte poslední známé funkční `Setup.exe` z historie
   [GitHub Releases](https://github.com/Boym323/MSFS-Companion/releases).
   Pokud přeinstalace na nižší verzi odmítne downgrade, nejprve
   odinstalujte stávající aplikaci, ale zachovejte zálohu dat.
5. Po obnovení zkontrolujte lokální dashboard, uvolnění portu
   8765 a záznamy letů. Teprve po opraveném vydání automatické
   aktualizace opět zapněte.

Pro skutečný **automatický** rollback bude zapotřebí nezávislá
kontrola zdraví nově instalované verze, uchování známé funkční
instalace a detekce, že se nový host vůbec nespustil.
Tento mechanismus je samostatná bezpečnostní etapa a bez
reálného Windows testu nesmí být automaticky aktivován.

## Síťová bezpečnost

LAN režim je záměrně bez uživatelského přihlášení (historický
požadavek projektu). Umožňuje kterémukoli zařízení ve stejné
důvěryhodné podsíti číst historii poloh a vyvolat aktualizaci.
Nezveřejňujte TCP 8765 na internetu; pro cizí nebo sdílenou síť
je nutná autentizace, TLS a revize bezpečnostního modelu.

## C33 – kontrola neplatného update journalu

Po restartu Windows host kontroluje, zda pending-update.json existuje a zda lze
jeho verzi, čas a schema platně přečíst. Pokud soubor existuje, ale data jsou
poškozená, neplatná nebo starší než povolené okno, další automatické aktualizace
se **pozastaví** a záznam se přesune mezi neověřené pokusy
(`failed-update.json`). Uživatel jej může vyšetřit v lokálním logu a po opravě
aktualizace znovu vědomě povolit. Jde o fail-closed ochranu proti tomu,
aby se neznámý stav vydával za potvrzený úspěch.

Tato změna **neimplementuje rollback** při pádu Windows hostitele ani jeho
nezávislý watchdog. Nedotýká se procesu MSFS, historii letů nemaže a nemění
formát dříve vytvořených platných journalů. Nutné ověřit na skutečné Windows
instalaci simulací poškozeného pending souboru i úspěšného restartu.

## C33 – ověření skutečně instalované verze

Při startu po aktualizaci již **nestačí**, že odpoví lokální HTTP server.
Windows host nejprve přečte verzi skutečné instalace Velopack a porovná ji
s `TargetVersion` v pending journalu. Teprve při přesné shodě pokračuje
HTTP health + web smoke. Jiná nebo neznámá verze znamená neověřenou
aktualizaci, přesun journalu do failed stavu a pozastavení auto-update.

`--self-test` nyní kontroluje i nesoulad verzí a spouští se v CI Windows
hostu pro každé PR zasahující host/workflow. Stále nejde o nezávislý watchdog
ani automatický rollback; integrační test chybného restartu Velopack na
skutečné instalaci nadále zůstává podmínkou jejich aktivace.

## C33 – smoke test skutečné instalace ve Windows CI

Workflow `windows-installer.yml` nyní po zabalení zkušebně **instaluje
skutečný Setup.exe** pomocí `--silent --installto` do oddělené dočasné
složky GitHub Windows runneru. Instalovaný host umí read-only argument
`--verify-installed-version <semver>`, který čte verzi z lokálního
Velopack kontextu, nikoliv ze statické `AssemblyVersion`.

CI ověřuje správnou verzi a odmítnutí chybné verze ještě před publikací
release. V tomto módu se nespouští tray, bridge ani kontrola aktualizací.
Nejde však o integrační test aktualizačního přechodu či rollbacku. Tyto
scénáře musí projít na skutečné instalaci Windows včetně simulace pádu
nového hostitele; automatický rollback proto zůstává záměrně vypnutý.

## C33 – oprava testu instalace

První nový instalační test v build v0.2.109 správně zastavil publikování:
read-only přepínač Windows hostitele ověřoval `UpdateManager.CurrentVersion`
před provedením nezbytné inicializace `VelopackApp.Build().Run()`.
Nyní inicializujeme Velopack (se zakázaným auto-apply při startu) ještě
před testovací kontrolou verze a do lokálního logu zaznamenáme shodu.

Pro další změny kritických souborů Windows aktualizačního mechanismu
spouští instalační workflow také **pull request build**, ale publikování
zůstává dostupné pouze pro úspěšný push do `main`. Při neúspěšné
instalované kontrole CI vypíše diagnostiku z dočasného Windows profilu.
Vývojová vydání zůstávají nepodepsaná, dokud není nakonfigurován podpis.
