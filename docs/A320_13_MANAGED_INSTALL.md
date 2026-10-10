# Automatická instalace a aktualizace A320 WASM modulu

Kokpit od této etapy sestavuje a balí **vlastní MSFS 2020 WASM modul** spolu
s Windows aplikací. Není potřeba další program ve Windows, přímé stahování
artefaktu GitHub Actions ani ruční kompilace pomocí SDK.

## Jednorázová instalace

1. Nainstalujte nebo aktualizujte Kokpit na nejnovější vydání.
2. **Vypněte MSFS 2020**.
3. Klikněte pravým tlačítkem na ikonu Kokpitu vedle hodin Windows.
4. Otevřete **Modul původního Asobo A320neo → Nainstalovat / aktualizovat modul…**.
5. Kokpit automaticky zjistí složku `Community` z nastavení MSFS 2020
   (`UserCfg.opt`; Steam nebo Microsoft Store). Pokud složka nejde zjistit,
   vyberte ručně **existující složku Community**.
6. Potvrďte instalaci a budoucí automatické aktualizace.
7. Spusťte MSFS 2020 a v `http://127.0.0.1:8765/a320` použijte
   **Ověřit připojení WASM modulu**. Teprve úspěšný ping a pilotní aktivace
   FCU umožní testovat Airbus-specific managed/selected příkazy.

## Další aktualizace

Souhlas zůstává uložený pouze na tomto PC. Při vydání nové verze
Windows aplikace se společně s ní distribuuje i aktuální zkompilovaný WASM
modul. Kokpit kontroluje shodu obsahu a **pokud MSFS neběží**,
automaticky vymění pouze svůj balíček. Je-li MSFS spuštěný, aktualizace
WASM se odloží na později. Samotnou aplikaci a telemetrii tato operace
nepřepíná ani nerestartuje.

Instalace nevyžaduje administrátorský přístup, pokud má váš uživatel
právo zapisovat do Community. Pokud právo chybí, instalace je odmítnuta;
Kokpit si nevyžádá tiché zvýšení oprávnění.

## Bezpečnostní pravidla

- Před prvním zásahem vždy **výslovný souhlas na Windows PC**.
- Pokud je složka `kokpit-asobo-a320-v1` obsazená cizím obsahem nebo
  neobsahuje vlastní značku, Kokpit ji **nepřepisuje a nemaže**.
- Instalují se pouze soubory `modules/kokpit-a320.wasm`,
  `manifest.json`, `layout.json` a vlastní stavová značka.
- Modul má SHA-256 kontrolu a je rozbalován do izolované staging složky.
  Při aktualizaci se původní balíček nejdřív přesune do zálohy;
  při chybě se aplikace pokusí obnovit původní verzi.
- Nesmí se instalovat za běhu `FlightSimulator.exe` ani do
  přesměrované složky Community.
- Odinstalace je v téže nabídce. Smaže **jen vlastní rozpoznaný balíček**
  a vypne budoucí automatické aktualizace modulu.
- Automatické aktualizace běžné aplikace jsou odlišné od samostatného
  souhlasu s úpravou Community.

## Ověření

Windows installer CI při každém vydání sestaví modul přímo z oficiálního
MSFS 2020 SDK 0.24.5, zabalí jej do `staging/app/a320-module`, provede
testy a kontroluje přítomnost payloadu i ve skutečně nainstalovaném
Velopack balíčku. CI navíc ověřuje izolovanou instalaci, aktualizaci,
ochranu cizích souborů a odmítnutí při běžícím simulátoru.

**Poznámka:** Úspěšná kompilace ani instalace sama o sobě není důkaz
funkčnosti Airbus managed/selected H-Events v konkrétní instalaci MSFS.
Pilotní akceptace na původním Asobo A320neo V1 je stále požadovaná.
PFD, ND, ECAM a MCDU displeje nejsou součástí této etapy.
