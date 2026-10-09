# C46 – relativní okolní provoz (informativní)

Zapnutá vrstva **Letadla z MSFS** na /map nově zobrazí nejvýše
pět nejbližších potvrzených objektů z existující read-only SimConnect
traffic čtečky (C26). Pro každé letadlo počítá vzdálenost v NM,
zeměpisný azimut, relativní sektor vůči headingu vlastního letadla
a rozdíl výšky ve ft.

Vypnutá vrstva nebo nedostupná/stará odpověď nemá žádné kontakty.
Nezavádíme další SimConnect spojení ani novou frekvenci API požadavků.
Údaje jsou porovnané ve stejných jednotkách ft a NM. Výběr objektů
je omezený a filtrován na validní rozsahy; výsledky jsou řazeny podle
vzdálenosti.

SimConnect provoz C26 není úplným obrazem multiplayeru nebo addonů.
Žádné volací znaky, předpovědi trajektorie, konflikty ani TCAS
z těchto dat nevyvozujeme. Regrese pokrývají směr, výškový rozdíl,
neplatné kontakty a přechod přes antimeridián.
