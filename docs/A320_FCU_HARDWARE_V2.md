# A320 FCU – fyzicky věrná podoba webového panelu (V2)

> **Aktualizace V3 (PR #114):** webové FCU je přepracováno podle [fotografie skutečného panelu FAA](https://www.faa.gov/sites/faa.gov/files/images/lessons_learned/VT-EPN/Flight_Directors.jpg). V původní V2 byly nesprávně dva centrální režimové voliče a viditelná webová tlačítka +/− kolem knobů. V3 používá jediný centrální momentový přepínač, správnější fyzické pozice čtyř knobů a AP1/AP2/A/THR, menší společný displej a šedý místo modrošedého povrchu. Webový editor a PUSH/PULL jsou nyní pod rozbalitelnou servisní částí; lze je otevřít, ale nepatří na fyzický panel. Knob lze na webu táhnout horizontálně nebo ovládat šipkami/myší; navrhovaná hodnota se nikdy neodešle bez potvrzení NASTAVIT.
>
> **Rozsah věrnosti:** předloha je skutečný A320 FCU, zatím bez pixel-by-pixel srovnání s původním Asobo A320neo V1 přímo ve hře. Přesnost živých FMA režimů a ovládání tlačítek AP1/AP2/LOC/APPR/EXPED/METRIC ALT stále není ověřena. Zakázané ovladače zůstávají vizuálně fyzické, nikoli funkční. Při absenci čerstvých SimVars jsou numerické hodnoty nepřístupné.

## Referenční uspořádání

Cílem je co nejvěrnější *webová rekonstrukce* klasické FCU původního
Asobo A320neo V1 v MSFS 2020, nikoli nový, zcela libovolný ovladač.
Rozložení bylo porovnáno s fotografiemi Airbus FCU, dokumentací
A320 Flight Deck and Systems Briefing a podklady FAA.

Zleva doprava nad jedním společným černým horním panelem:

- SPD/MACH (3 číslice / Mach decimal), HDG/TRK/LAT (3 číslice),
  ALT/LVL/CH (5 číslic), V/S/FPA (znaménko a 4 číslice).
- SPD/MACH přepínač a rychlostní knob.
- HDG/TRK knob a LOC; mezi HDG a ALT ovládání HDG/TRK a V/S/FPA,
  autopilotní tlačítka AP1/AP2 a A/THR.
- ALT knob se značkami 100/1000, samostatná fyzická indikace
  METRIC ALT a tlačítko EXPED.
- V/S knob s UP/DN značkami a popisem PUSH TO LEVEL OFF,
  tlačítko APPR pod ním.

Pozadí používá odstín šedomodrého plastu, pozlaceně působící
sedmisegmentová LED okénka, mechanické knoby, kontrastní gravírované
popisky, zapuštěná tlačítka a šrouby panelu. Nejde o fotografii ani
o kopii konkrétních bitmap či chráněných výrobních podkladů.

## Použití na iPadu

Originální geometrie se **nepřekládá do mobilních karet**.
FCU zůstává vodorovný fyzický celek s vodorovným posuvem při
šířce pod 1200 CSS px. Pod ním je oddělený **rozbalitelný** webový ovládací
panel se čtyřmi poli pro zadání referencí a s
PUSH/PULL pro tři povolené WASM akce.

Tažení knoflíku doleva/doprava, stejně jako kolečko myši nebo klávesové šipky,
mění pouze návrh referenční hodnoty. Letadlo dostane povel až
po klepnutí na **NASTAVIT**. Přepínač SPD/MACH mění pouze
zobrazený referenční údaj na webu. Webový volič 100/1000
mění pouze krok editace výšky; nepřestavuje fyzický přepínač
v simulátoru.

## Zabezpečení a reálný stav

- Neověřené AP1/AP2/A/THR/LOC/EXPED/APPR/METRIC ALT,
  HDG/TRK a V/S/FPA rotary selectors zůstávají *disabled*.
- Neaktivní tlačítka neindikují falešný zelený stav.
- Displej ukazuje čerstvé **generické SimVars**, ne
  ověřený obsah původního FCU/FMA. Při nedostupnosti
  přejde na pomlčky, ne na smyšlené nuly.
- Všechny skutečné příkazy používají existující serverový
  allowlist a armování pro konkrétní letadlo a připojení.
- WASM příkazy managed/selected zůstávají experimentální;
  ACK potvrzuje přijetí H-event v modulu, nikoli změnu
  Airbus režimu.

## Reference fyzického rozložení

- [FAA – Airbus Flight Control Unit](https://www.faa.gov/lessons_learned/transport_airplane/accidents/VT-EPN)
- [A319/A320/A321 Flight Deck and Systems Briefing](https://ads-b.ca/a320/A319-320-321_Flight_Deck_and_Systems_Briefing_for_Pilots.pdf)
- [Airbus A320 FCU photograph (Pilotstories)](https://pilotstories.net/airbus-a320-cockpit/)

## Akceptace

- [x] Replika je horizontální jako originální FCU.
- [x] Věrné fyzické umístění čtyř oken, knobů a funkčních tlačítek.
- [x] Vlastní sedmisegmentové SVG zobrazovače; žádné externí fonty.
- [x] Původní chráněné příkazy zůstávají beze změny.
- [x] Úzké obrazovky používají vodorovné posouvání celé repliky.
- [ ] Snímky V3 z reálného iPadu a vizuální porovnání se skutečným letadlem / původním Asobo A320neo.
- [ ] Živé ověření změn FCU/FMA po WASM H-events v MSFS 2020.
- [ ] Samostatná ověřená integrace AP1/AP2 a všech ostatních tlačítek.
