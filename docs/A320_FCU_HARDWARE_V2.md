# A320 FCU – fyzicky věrná podoba webového panelu (V2)

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
šířce pod 1050 CSS px. Pod ním je oddělený webový ovládací
panel se čtyřmi poli pro zadání referencí a s
PUSH/PULL pro tři povolené WASM akce.

Kliknutí nebo dotyk knoflíku, stejně jako +/- a kolečko myši,
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
- [ ] Snímky z reálného iPadu a vizuální porovnání s letadlem.
- [ ] Živé ověření změn FCU/FMA po WASM H-events v MSFS 2020.
- [ ] Samostatná ověřená integrace AP1/AP2 a všech ostatních tlačítek.
