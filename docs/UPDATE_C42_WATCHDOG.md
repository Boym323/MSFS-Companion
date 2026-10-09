# C42 – nezávislý hlídač neúspěšných Windows aktualizací

Kokpit obsahuje volitelnou samostatnou komponentu
`MsfsCompanion.RecoveryWatch.exe`. Jde o **součást instalačního
balíčku**, nikoliv další aplikaci, kterou je nutné samostatně
instalovat. Při aktualizaci se tato malá konzolová aplikace
kopíruje do lokální uživatelské složky mimo adresář Velopack
`current`, aby ji samotná aktualizace nevyměnila.

## Bezpečnostní zásady

1. **Výchozí nastavení je vypnuto.** Uživatel musí v nabídce
   Windows tray zaškrtnout experimentální hlídání a výslovně potvrdit rizika.
2. Watchdog se spouští pouze pokud je před aktualizací prokazatelně
   uložený předchozí celý `.nupkg` s kontrolou SHA-256 a journal
   obsahuje přesnou cílovou i předchozí verzi.
3. Po ukončení starého hostitele čeká až 240 sekund na start nového.
   Úspěch rozpozná pouze podle `last-verified-update.json` se
   správným cílem a časem. Nevěří pouze tomu, že HTTP port odpovídá.
4. Pokud není start potvrzený, obnovu připustí jen když aktuální
   lokálně instalovaná binárka skutečně odpovídá cílové verzi,
   **neběží hostitel ani bridge** a uložený balíček znovu prošel
   hashovým testem.
5. Před jediným pokusem zapíše `attempt-<cílová-verze>.json`
   atomicky přes `CreateNew` a deaktivuje automatické
   aktualizace i watchdog v `settings.json`. Následně požádá
   nativní `Update.exe apply --package` o přechod na starý balíček.
   Nikdy přímo nemění DLL/EXE soubory nebo MSFS.
6. Pokud některou podmínku nelze bezpečně ověřit, **neprovádí nic**.
   Využijte ruční obnovu z Windows tray nebo GitHub Releases.

## Ověření a omezení

CI sestaví samostatnou konzoli pro Windows do jednoho spustitelného
souboru, přibalí ji do `Setup.exe`, spustí `--self-test` a
na čisté instalaci ověří číslo instalované verze. Zatím
**neproběhl destruktivní integrační test dvou verzí, při kterém
nový hostitel po upgradu opravdu selže**. Proto je funkce
záměrně **experimentální, opt-in a default OFF**.

Není zde služba Windows, trvalý proces mimo upgrade ani
pravidelné síťové požadavky. Hlídač se spustí jen na dobu
konkrétní aktualizace a používá lokální soubory.


## Auditní oprava: selhání požadované ochrany zastaví aktualizaci

Pokud uživatel **výslovně zapne experimentální watchdog**, hostitel
před aktualizací požaduje důvěryhodný balíček **přesně předchozí
nainstalované verze**. Chybí-li verze, hashově ověřený balíček
nebo se watchdog nespustí, aktualizace se **nespustí** a UI uvede důvod.
Pokud již existuje update journal, pokusí se jej bezpečně zrušit
ještě před spuštěním aktualizátoru.

S vypnutým watchdogem zůstává původní chování: aktualizace
může proběhnout bez dostupného rollbacku, avšak s update journalem
a diagnostikou. Není to tvrzení, že automatická obnova byla ověřena
na skutečném selhání dvou Windows verzí.
