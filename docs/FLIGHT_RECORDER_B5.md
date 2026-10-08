# B5 – Flight Recorder

## Co se ukládá

Záznam letu vzniká automaticky na počítači s MSFS 2020,
pokud bridge dostává **aktuální telemetrii**.
Je ukládán na pozadí přibližně **jednou za sekundu**;
nemusíte mít otevřený Mac ani stránku s mapou.

Sledujeme GPS, IAS, výšku, vertikální rychlost, kurz,
klopení, náklon a čas. Z údajů vypočítáváme orientační
délku trasy, nejvyšší rychlost, nejvyšší výšku a délku letu.
Při odpojení na více než 10 sekund se let uzavře.
Při restartu aplikace se předchozí záznam bezpečně uzavře.
Delší než šestihodinový let se rozdělí na více relací.

## Ukládání a ochrana soukromí

Data zůstávají lokálně v profilu Windows uživatele:

```text
%LOCALAPPDATA%\MSFS Companion\flights
```

Jde o `.jsonl` se vzorky a samostatný `.meta.json`
s metadaty. Soubory se atomicky aktualizují a při
dalším spuštění se nedokončené relace označí jako uzavřené.

Zachovává se maximálně **30 posledních letů** a **100 MB**
všech uložených relací dohromady. Starší lety se při údržbě
automaticky odstraní. Maximální délka jedné relace je šest
hodin. Při webovém zobrazení vracíme nejvýše 4000 bodů,
aby se nezatěžoval prohlížeč.

**Důležité:** Historie obsahuje přesné zeměpisné souřadnice
letů. V domácí podsíti ji bez přihlášení mohou číst ostatní
zařízení. Nikdy neotevírejte port 8765 do internetu.

Pokud Windows aplikaci přepnete do testovacího režimu
`mock`, i tyto záznamy jsou označeny **TESTOVACÍ DATA**;
nikdy se netváří jako skutečné lety.

## Web

Na Macu otevřete `http://IP_WINDOWS_PC:8765/flights`.
Uvidíte přehled posledních letů, základní statistiky,
graf rychlosti a výšky, orientační GPS trasu a časový posuvník.

Tlačítko **Přehrát let** přejde zaznamenané body přibližně
po jedné sekundě. U delších záznamů může být časová osa
pro účely zobrazení převzorkovaná.

## Ověření

1. Zapněte Windows MSFS Companion v režimu SimConnect.
2. Odstartujte a leťte nejméně 15 sekund.
3. Na Macu otevřete `/flights`; nový let musí být ve výpisu,
   včetně průběžného růstu počtu bodů.
4. Zavřete prohlížeč, pokračujte v letu a později jej
   znovu otevřete. Ukládání má pokračovat.
5. Ověřte přehrávání, trasu a grafy.
6. Při ukončení simulátoru zkontrolujte uzavření záznamu.

Záznam je určen výhradně pro **simulátor**, nikoli
jako právně závazný záznam skutečného letu.
