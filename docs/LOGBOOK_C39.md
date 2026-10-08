# C39 – rozšířený letový deník

## Export
Na `/flights` lze vedle CSV vytvořit GPX 1.1 a KML 2.2 v prohlížeči.
Souřadnice jsou filtrovány, nadmořská výška se přepočte z feet na metry,
XML znaky v názvu letadla se escapují. Export je omezen na nejvýše 10 000
přijatých záznamů a nevytváří další spojení se SimConnect.

## Srovnání
Volba druhého letu provede jednorázové načtení z místního bridge,
porovná vzdálenost, maximální IAS, počet potvrzených kontaktů se zemí
a případnou touchdown rychlost. Bez spolehlivé `onGround` historie
nelze z těchto údajů usuzovat na kvalitu přistání.
Souřadnice GPX/KML zůstávají v souboru, proto export nesdílejte veřejně,
pokud si nepřejete odhalit oblast letu.

## Testy
Regresní testy jsou součástí již běžícího `performance.test.mjs`.
Integrace s reálným MSFS 2020 zůstává k manuálnímu ověření.
