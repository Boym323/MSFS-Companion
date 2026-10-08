# C18 – další letové statistiky a export CSV

Přímo na stránce `/flights` se ze stávajícího záznamu SimConnect
vypočítává: známý čas ve vzduchu, průměrná indikovaná rychlost za letu,
maximální absolutní náklon, maximální zaznamenaná výška AGL a vzdálenost
vypočítaná ze souvislých GPS úseků.

Výpočet neodhaduje stav na zemi, pokud chybí `onGround`. Mezery
přes 30 sekund a nereálné GPS přeskoky nejsou považovány za proletěnou
vzdálenost. U starších letů chybějící údaje zobrazujeme „—“.

Export CSV obsahuje každé dostupné pole ze záznamu: čas, GPS, IAS,
výšku, VS, HDG, pitch, bank, AGL, onGround a případný touchdown
rate/G. Výstup vzniká přímo v prohlížeči z již staženého letu a
není posílán do žádné jiné služby. Soubor obsahuje přesnou polohu
letadla a je potřeba s ním zacházet jako s osobní historií letu.

Vše je soběstačné; není potřeba SimToolkitPro ani jiná aplikace.
Deterministické Node testy kontrolují neúplné záznamy, výpadky,
teleportaci a CSV export. Hodnoty platí jen pro uložené vzorky
(sampling přibližně 1 Hz), nejde o certifikovanou letovou analytiku.
