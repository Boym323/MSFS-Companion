# B1 – Diagnostika kompatibility SimConnect s MSFS 2020

Diagnostická aplikace v `apps/probe` **nemění nastavení simulátoru**.
Čte standardní SimVars, volitelně vypisuje Input Events a vytváří
JSON report. Je oddělená od webového bridge.

## Stažení a spuštění

1. Na GitHubu otevřete **Actions → SimConnect Probe (Windows)**.
2. Vyberte úspěšný běh a stáhněte artefakt
   `MSFS-Companion-SimConnect-Probe-win-x64`.
3. Rozbalte ZIP na Windows PC, všechny soubory nechte ve stejné složce
   (včetně `SimConnect.dll`).
4. Spusťte MSFS 2020 a načtěte let, například s Cessnou 172.
5. V rozbalené složce otevřete PowerShell a zadejte:

```powershell
.\MsfsCompanion.Probe.exe --duration 30 --wait 90
```

Aplikace zobrazuje rychlost IAS, výšku, kurz, vertikální rychlost,
klopení a náklon. Výsledný report uloží do:

```text
%USERPROFILE%\Documents\MSFS Companion\simconnect-report.json
```

Report obsahuje také **GPS souřadnice** a technickou diagnostiku.
Před veřejným sdílením jej zkontrolujte.

Sestavení obsahuje potřebný .NET runtime pro Windows x64;
na PC se simulátorem není třeba instalovat vývojové nástroje.
Automatický CI self-test ověřuje jen běh aplikace mimo MSFS,
nikoli skutečné připojení.

## Parametry

```text
--wait SECONDS           Čekání na počáteční spojení (5–600, výchozí 90)
--duration SECONDS       Doba měření (5–300, výchozí 30)
--report PATH            Jiná cílová cesta JSON reportu
--lvar L:KNOWN_NAME      Volitelný read-only test známé LVar
--skip-input-events      Vynechání výpisu Input Events
--self-test              Test reportu bez připojení k simulátoru
--help                   Nápověda
```

Při nedostupném simulátoru aplikace zkouší opakované spojení
po dobu určenou parametrem `--wait`. Chyby a počet pokusů
zaznamenává do reportu.

**LVars:** diagnostika nevymýšlí názvy proměnných. Hodnota nula
sama o sobě nedokazuje existenci konkrétní LVar.

**Input Events:** jejich výpis je pouze pro čtení. Chyba nebo timeout
neprokazuje, že je všechny daný simulátor nepodporuje.

**Ovládání:** diagnostika neposílá povely autopilotu ani rádia.
Ověření zápisových událostí vyžaduje samostatný potvrzený test.

## Technické informace

- .NET 10, samostatné sestavení pro `win-x64`.
- Balíček `SimConnect.NET` 0.2.2 s licencí MIT.
- Obsahuje nativní Microsoft `SimConnect.dll`; před veřejnou
  distribucí je nutné ověřit podmínky dalšího šíření.
- Knihovna je ve vývoji a chování se ověřuje proti konkrétní
  instalaci MSFS 2020.
- B1 provádí záměrně pomalé jednotlivé dotazy. Rychlé
  subscriptions pro PFD patří do B2.

Report používá schéma `simconnect-probe-v1` s časovými značkami,
stavem připojení, testy funkcí, chybami a naměřenými vzorky.
Režim `--self-test` vytváří `connection: "self_test_only"` bez
skutečných vzorků ze simulátoru.
