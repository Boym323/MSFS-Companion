# Kokpit UI – vizuální screenshot baseline (UI-REF-7)

Workflow: .github/workflows/visual-ui.yml. Vytváří skutečné Chromium
screenshoty a ověřuje rozložení; nejde pouze o kontrolu JSX a CSS.

## Co se zachytí

- Sedm šířek: desktop 1440×900, menší desktop 1280×800, iPad landscape 1024×768,
  iPad portrait 768×1024, telefony 390×844, 375×812 a 320×700.
- Šest Airbus záložek: FCU, EFIS/ND, Overhead, ECAM, MCDU,
  Diagnostika – celkem 42 screenshotů.
- Kompaktní Airbus Workspace v každém viewportu – dalších 7.
- manifest.json s velikostí viewportu, názvy snímků a měřením přetečení.

## Automatické kontroly

Každá záložka musí mít přesně jednu aktivní navigační položku,
jeden montovaný přístroj a žádný horizontální overflow celé stránky.
Přímé odkazy a historie prohlížeče musí fungovat. Workspace nesmí
montovat celý Airbus dashboard. Po otevření stránka nesmí mít
neošetřené chyby JavaScriptu.

## Omezení

Snímky jsou offline baseline: bez skutečného MSFS a bridge,
proto zobrazují pouze odpojené či nedostupné stavy.
Neprokazují živou funkčnost WASM, MCDU nebo FMA ani úplnou
vizuální shodu s originálním kokpitem Airbus.

Na telefonech do 600 px zůstává formulář FCU v jediném sloupci,
aby hodnoty a ovládací tlačítka měly dostatečnou šířku.

Workflow zatím nezavádí automatický pixelový diff.
První referenční obrázky musí být nejdříve skutečně zkontrolovány;
pro další verzi budou sloužit jako schválená baseline.

Artifact na stránce Actions se jmenuje kokpit-ui-visual-baseline.
Snímky jsou rozdělené podle názvu zařízení a sekce.
