# C50 – rozložení Kokpitu podle aktuálního letadla

Stránka `/workspace` nově nabízí **výslovně volitelný** návrh
rozložení pro C172, TBM930, XCub a univerzální letadla. Vychází z
TITLE aktuálního letadla; nejde o důkaz podporované avioniky.

Pilot může uložit své vlastní rozložení pod přesným názvem
aktuálního letadla do `localStorage` konkrétního prohlížeče a
ručně jej znovu načíst. Rozložení má nadále max. 3 panely a 1–2
sloupce; každý načtený údaj projde existující validací.
Nevzniká nový proces, bridge API ani SimConnect spojení.

**Nic se nepřepíná automaticky při změně letadla nebo během letu.**
U tlačítek avioniky musí stále proběhnout samostatná enumerace
a manuální kontrola. Profily zůstávají lokální na daném iPadu/Macu.
