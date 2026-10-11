# Kokpit UI – vizuální screenshot baseline (UI-REF-7)

Workflow: .github/workflows/visual-ui.yml. Vytváří skutečné Chromium
screenshoty a ověřuje rozložení; nejde pouze o kontrolu JSX a CSS.

## Co se zachytí

- Pět šířek: desktop 1440×900, iPad landscape 1024×768,
  iPad portrait 768×1024, telefon 390×844 a 320×700.
- Šest Airbus záložek: FCU, EFIS/ND, Overhead, ECAM, MCDU,
  Diagnostika – celkem 42 screenshotů.
- Kompaktní Airbus Workspace v každém viewportu – dalších 7.
- Sedm hlavních obrazovek (přehled, PFD, mapa, historie, ovládání,
  diagnostika a letový asistent) v každém viewportu – dalších 49.
- Dvě zkoušky celoobrazovkového zobrazení FCU – další 2.
- Rozbalené offline ovládání rádia a autopilota – dalších 7.
- Dva další screenshoty rozbalených mapových vrstev (desktop, mobil).\n- manifest.json s velikostí viewportu, názvy snímků a měřením přetečení.

## Automatické kontroly

Každá záložka musí mít přesně jednu aktivní navigační položku,
jeden montovaný přístroj a žádný horizontální overflow celé stránky.
Nově se stejný horizontální overflow a viditelnost aktivní hlavní
navigace kontroluje i na sedmi běžných obrazovkách.
A320 nesmí duplikovat globální offline hlášku; při offline stavu
zůstává stav MSFS v hlavičce, detaily povolení jsou sbalené.
Přímé odkazy a historie prohlížeče musí fungovat. Workspace nesmí
montovat celý Airbus dashboard. Po otevření stránka nesmí mít
neošetřené chyby JavaScriptu.

Mapa se kontroluje i interaktivně: zoom +/− musí být přímo v mapě,\nrozbalení vrstev nesmí způsobit horizontální přetečení a prázdná\nstopa nesmí nabízet aktivní mazací tlačítko. Mobilní FCU používá\njednosloupcové ovládací formuláře s minimální velikostí 44 px.\n\n## Omezení

Snímky jsou offline baseline: bez skutečného MSFS a bridge,
proto zobrazují pouze odpojené či nedostupné stavy.
Neprokazují živou funkčnost WASM, MCDU nebo FMA ani úplnou
vizuální shodu s originálním kokpitem Airbus.

Workflow zatím nezavádí automatický pixelový diff.
První referenční obrázky musí být nejdříve skutečně zkontrolovány;
pro další verzi budou sloužit jako schválená baseline.

Artifact na stránce Actions se jmenuje kokpit-ui-visual-baseline.
Snímky jsou rozdělené podle názvu zařízení a sekce.

## Následná oprava ovládání

Na stránce `/controls` je stále vidět zabezpečení, aktuální stav
spojení a případné párování. Když není MSFS živě připojený, celý
obsáhlý formulář s neaktivními příkazy je standardně sbalený,
ale lze ho rozbalit pro prohlížení. Při živém MSFS je rozbalený.
CI ověřuje, že po otevření offline zůstávají příkazy neaktivní.
