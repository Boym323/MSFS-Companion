# Bezpečnost dodavatelského řetězce – Kokpit

## Automatizované kontroly

`.github/workflows/dependency-security.yml` se spouští každé pondělí
a ručně přes GitHub Actions. Při změně `package*.json`,
NuGet `*.csproj` nebo vlastního workflow kontroluje také pull request.

- **npm**: přesný `npm ci` podle lockfile a `npm audit
  --audit-level=high`; selže při nalezeném vysokém či kritickém
  advisory, včetně build-time závislostí.
- **NuGet**: .NET 10 restore s auditováním přímých i transitivních
  balíčků, pouze HIGH/CRITICAL `NU1903`/`NU1904` jako chyby.
  Samostatně pro bridge, Windows tray a integrovaný watchdog.

Bezpečnostní selhání se řeší aktualizací konkrétní závislosti,
regresními testy a standardním PR. Neprovádět hromadné slepé
povyšování major verzí ani plošné vypnutí NuGetAudit. Pravidelná
kontrola GitHub Actions je doplňkem, ne náhradou kontroly diffů.

## Co tento audit neprokazuje

- `npm audit` a NuGet audit odhalí **známé** databázové
  zranitelnosti; nenahradí review zdrojového kódu, runtime
  penetrační test ani záruku neškodného balíčku.
- SHA-256 v C42 kontroluje integritu lokálně zachovaného souboru,
  **není podpis vydavatele**. Dokud není ověřený Windows code-signing
  certifikát / CI secret, instalační `Setup.exe` může být
  nepodepsaný. Před produkčním povolením automatického rollbacku
  zůstává nutný destruktivní test A→B→A na Windows.
- G1000 Input Events a skutečný MSFS 2020 vyžadují zvláštní
  pilotní akceptační test; GitHub hosted runner simulátor nespouští.

Workflow nemusí automaticky vytvářet issue ani odesílat e-mail.
Selhání je viditelné v GitHub Actions a musí se lidsky posoudit.
