# Automatické aktualizace – domácí síť

Windows hostitel používá Velopack a veřejná GitHub Releases
repozitáře `Boym323/MSFS-Companion`.

- Nová verze se publikuje po úspěšném Windows buildu v `main`.
- Na Windows se aktualizace kontrolují přibližně 20 sekund
  po spuštění a dále každých 60 minut.
- Na místním dashboardu lze kdykoli kliknout na
  **Vynutit kontrolu a instalaci nové verze**. Tlačítko
  okamžitě odešle požadavek bez potvrzovacího dialogu;
  průběh a případné chyby se ukazují přímo v panelu.
- Kontrola je přístupná pouze ze stejné privátní podsítě;
  nevyžaduje klíč ani Tailscale.
- Nová verze může restartovat MSFS Companion a bridge i
  při běžícím simulátoru. MSFS se nerestartuje.
- Pokud nová verze neexistuje, aktuální instalace zůstane beze změny.

Tento režim je určen pouze pro důvěryhodnou domácí síť:
**každé její zařízení může o aktualizaci požádat**.
Bridge omezuje síťový rozsah, Host a původ POST požadavků.
Nesmí být zveřejněn na internetu.

Přesný návod k Windows Firewallu a použití na Macu:
[Instalace a ovládání v domácí síti](WINDOWS_INSTALLER.md).

Nepodepsaná vývojová vydání zatím nemají automatické
obnovení předchozí verze. Windows instalace od B2 obsahuje
živý zdroj SimConnect; jeho skutečný provoz je nutné ověřit
přímo se spuštěným MSFS 2020.
