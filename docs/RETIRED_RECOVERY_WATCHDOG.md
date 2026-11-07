# Odstranění experimentálního recovery watchdogu

Z instalátoru i zdrojů je odstraněn oddělený proces
`MsfsCompanion.RecoveryWatch.exe`, jeho `--watch` supervisor,
konfigurace `EnableRecoveryWatchdog`, položka Windows tray a
kontroly jeho přibalení v CI. **Nové vydání už tento watchdog
nespouští ani neinstaluje**.

Zůstává:
- kontrola health/web po aktualizaci, při jejím neúspěchu pozastavení
  automatických aktualizací;
- aktualizační journal `UpdateRecoveryJournal` (provenance a fail-safe);
- ověřená lokální kopie plného balíčku předchozí verze
  `RecoveryPackageCache` (SHA-256);
- **pouze ručně vyžádaná** obnova předchozího balíčku ve Windows tray,
  se samostatným potvrzením a upozorněním;
- normální Velopack aktualizace, kontrola verzí a ochrana Windows hostitele.

Stará `EnableRecoveryWatchdog` položka v settings.json je při načtení
ignorována; další uložení ji už nezapíše. Žádná skutečná uživatelská
data se nemažou. Soubory staré verze v rámci jiných již instalovaných
Velopack balíčků nebo v `LocalAppData` se **neodstraňují automaticky**.
Samotnou ruční obnovu je nutné před vydáním ověřit na oddělené
instalaci Windows.

PR navazuje na odstranění Asobo V1/WASM #152 a není určen
k okamžitému sloučení do main bez schválení.
