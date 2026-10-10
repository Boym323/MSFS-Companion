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

## Kompilace vyžaduje MSFS 2020 SDK

DŮLEŽITÉ: zdrojový soubor C++ není dosud zkompilovaný oficiálním MSFS 2020 SDK.
Nejde tedy o hotové fyzické ovládání ani o součást nainstalovaného release.

1. Na vývojovém Windows s MSFS 2020 SDK vytvořit nový projekt
   typu MSFS WASM Module (platform toolset pro MSFS **2020**).
2. Zaměnit obsah Module.cpp za apps/a320-wasm/KokpitA320Module.cpp,
   přidat do SDK projektu hlavičky MSFS, SimConnect, Legacy/gauges.
3. Sestavit KokpitA320Module.wasm a vyřešit případné SDK kompatibility.
4. V kořeni repozitáře spustit:
   python scripts/package-a320-wasm.py CESTA/KokpitA320Module.wasm build/a320
5. Výslednou složku build/a320/kokpit-asobo-a320-v1 umístit do správného
   Community adresáře až **po výslovném souhlasu** při vypnutém MSFS.
   Samotný Windows host tím nepřidává nový samostatně běžící proces.
6. Spustit simulátor, otevřít localhost /a320, provést WASM probe.

MSFS Community balíček obsahuje soubory:
- modules/kokpit-a320.wasm
- manifest.json
- layout.json

## Akceptace, která stále chybí

- [ ] WASM skutečně kompiluje pod oficiálním MSFS 2020 SDK
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
