# Automatické aktualizace Windows – vývojový režim

Hostitel Windows je v `apps/windows-host` a používá Velopack.
Praktický návod: [Windows instalace a vzdálená správa](WINDOWS_INSTALLER.md).

- **Zdroj:** veřejné GitHub Releases v `Boym323/MSFS-Companion`.
- **Publikování:** po úspěšném sestavení změn v `main` automaticky
  vzniká vydání s verzí `v0.2.<číslo běhu>`.
- **Windows hostitel:** automaticky se spouští po přihlášení, hlídá bridge
  a kontroluje novou verzi po spuštění a každou hodinu.
- **Během MSFS:** aktualizace smí restartovat jen Companion a bridge,
  nikoli simulátor.
- **Správa z webu:** autentizovaný požadavek předaný do lokálního
  souborového kanálu. Stav lze sledovat bez přístupu na Windows plochu.
- **Zabezpečení:** správcovský klíč je náhodný a uložený v profilu
  Windows uživatele, nikdy není součástí veřejného vydání.
- **Přístup z Macu:** po jednorázovém nastavení Tailscale Serve.
- **Omezení:** nepodepsané vývojové balíčky, bez automatického rollbacku;
  skutečný upgrade a vzdálený přístup je nutné ověřit na počítači s MSFS.

Samostatné spuštění `apps/bridge` nemá aktivní správcovská API.
Repozitář je veřejný, není potřeba druhý repozitář ani přístupový
token GitHubu na klientském PC.
