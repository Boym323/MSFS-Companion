# A320-12 – nativní H-Events pro původní Asobo A320neo (MSFS 2020)

## Co obsahuje repozitář

Jedná se o další integrační vrstvu **před druhým kolem displejů**.

- Zdroj vlastního WASM modulu: apps/a320-wasm/KokpitA320Module.cpp.
- Windows SimConnect ClientData transport: apps/bridge/Airbus/A320WasmEventSender.cs.
- C# protokol: A320WasmProtocol.cs, 16B příkaz i odpověď, verze 1.
- HTTP: GET /api/a320/wasm/status, POST /api/a320/wasm/probe (pouze localhost),
  POST /api/a320/wasm/command.
- /a320 obsahuje H-event tlačítka. Bez ping modulu a pilotní aktivace jsou neaktivní.
- Výhradně šest H-událostí s pevnými čísly. Neexistuje přenos libovolného
  kalkulátorového kódu, názvu H-události nebo neznámé operace z webu.

| Akce API | Přesný zdrojový H-event |
|---|---|
| a320.fcu.speed.selected | A320_Neo_CDU_MODE_SELECTED_SPEED |
| a320.fcu.speed.managed | A320_Neo_CDU_MODE_MANAGED_SPEED |
| a320.fcu.heading.selected | A320_Neo_CDU_MODE_SELECTED_HEADING |
| a320.fcu.heading.managed | A320_Neo_CDU_MODE_MANAGED_HEADING |
| a320.fcu.altitude.selected | A320_Neo_CDU_MODE_SELECTED_ALTITUDE |
| a320.fcu.altitude.managed | A320_Neo_CDU_MODE_MANAGED_ALTITUDE |

Účinek událostí je odvozen ze zdrojových Asobo model behavior templates.
Skutečné ovládání původní V1 musí být potvrzeno v MSFS. Přijetí zprávy modulem
neprokazuje změnu režimu FCU nebo FMA.

## Zabezpečení a izolace

Před každým odesláním ověřit živé MSFS, čerstvý TITLE původního A320neo
kandidáta, čerstvou 1Hz FCU referenci a explicitní pilotní aktivaci
na Windows localhost na 30 minut pro dané připojení. Zůstává ochrana
same-origin, případný párovací token a limit 250 ms. Modul nikdy nepřijímá
libovolný RPN/HTML/skript. Transport používá samostatný SimConnect handle,
nepřerušuje 20Hz PFD a neodesílá příkaz znovu při timeoutu.

Pokud modul není nainstalovaný, vrátí probe nedostupnost a všechny H-Event
ovladače zůstávají zakázané. Stav dostupnosti vyprší po 90 sekundách.

## Automatické sestavení v GitHub Actions

WASM se kompiluje skutečným oficiálním **MSFS 2020 SDK Core 0.24.5**,
nikoliv náhradními hlavičkami. První úspěšný SDK build a vytvoření
Community ZIP ověřuje workflow
[`Asobo A320 WASM SDK build`](../../actions/workflows/a320-wasm.yml),
např. [run 38056769638](../../actions/runs/38056769638).

Workflow na Windows 2022:
1. stáhne a tiše nainstaluje původní MSFS 2020 SDK z oficiální adresy;
2. sestaví `apps/a320-wasm/KokpitA320Module.vcxproj` pro platformu
   `Release|MSFS` pomocí Visual Studio MSBuild a SDK toolsetu;
3. ověří, že výsledný `kokpit-a320.wasm` má platnou WASM hlavičku;
4. spustí `scripts/package-a320-wasm.py` a vytvoří instalační
   `Kokpit-Asobo-A320-WASM-Community.zip`;
5. uloží ZIP i rozbalený modul jako GitHub Actions artefakt
   **Kokpit-Asobo-A320-WASM-Community** na 30 dní.

**Jak nainstalovat modul do MSFS 2020:**
Z úspěšného běhu GitHub Actions stáhnout artefakt, rozbalit ZIP
a složku `kokpit-asobo-a320-v1` umístit do skutečného MSFS 2020
`Community` adresáře při vypnutém simulátoru. Po startu MSFS otevřít
`http://127.0.0.1:8765/a320` a spustit lokální kontrolu WASM.

Součást balíčku: `modules/kokpit-a320.wasm`, `manifest.json`
a `layout.json`. Build nepotřebuje MSFS spuštěný a nevydává
žádné SDK knihovny. Vydání Windows hostu modul samo neinstaluje:
přístup do složky Community se nemění bez souhlasu pilota.

**Kompilace PASS neznamená živé potvrzení funkce H-events.**
Přijetí H-event příkazu musí pilot dále ověřit na fyzickém FCU
původního Asobo A320neo V1 v běžícím MSFS 2020.

## Akceptace, která stále chybí

- [x] WASM se sestavuje oficiálním MSFS 2020 SDK 0.24.5 v GitHub Actions
- [ ] Module init vytváří ClientData command/response areas bez kolize
- [ ] Ping module/bridge prokazatelně funguje na Windows v původním Asobo V1
- [ ] Jednotlivé H-události mění příslušné FCU push/pull managed/selected
- [ ] Neodpovídající TITLE a změna letadla nic neovládají
- [ ] SimConnect reconnect zachovává PFD a zneplatňuje autorizaci
- [ ] Na skutečném PC nejméně 15 minut bez samovolného reconnectu
- [ ] Displeje PFD/ND/ECAM/MCDU se zatím nepřenášejí

SDK zdroje:
- https://docs.flightsimulator.com/html/Content_Configuration/Models/ModelBehaviors/TemplateExplorer/Asobo/Common/Subtemplates/Autopilot_Subtemplates.html
- https://docs.flightsimulator.com/html/Programming_Tools/WASM/WebAssembly.htm
- https://docs.flightsimulator.com/html/Samples_And_Tutorials/Samples/Misc/StandaloneModule.htm
