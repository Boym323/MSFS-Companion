# A320-04 – iPad / notebook dashboard

Nová samostatná stránka `/a320` používá stávající spojení,
nový read-only `/api/aircraft/airbus/a320/status`
a stávající navigaci `/api/navigation/current`.

- Dvě samostatné karty motorů: N1/N2 a fuel flow PPH
  (bez převodu na ECAM kg/h – dokud není ověřený).
- FCU: generic SPD/MACH/HDG/ALT/VS, AP master a raw SLOT INDEX.
  **Nejde o FMA / managed-selected readback ani o ovládání!**
- Navigace: pouze podporovaný aktivní GPS úsek; odkaz na
  plnohodnotnou existující mapu.
- Identita: čerstvé TITLE ze SimConnectu musí přesně odpovídat
  telemetrii v prohlížeči. Pokud je neznámé, jiné či zastaralé,
  vše se skryje místo falešných nul.
- Responzivní rozvržení do dvou/jen jednoho sloupce, bez externího
  SW na Windows.
- Manuálně dostupné v `/workspace` jako panel `a320`.
  Doporučená konfigurace PFD/Mapa/Airbus se **nikdy sama
  neaktivuje** při změně letadla – zůstává ruční volbou pilota.

Ověření bez simulátoru: webové TS build + regresní test
`aircraftPresets.test.mjs`. Skutečný Asobo A320neo musí pilot
otestovat podle `docs/ACCEPTANCE_A320.md`.
