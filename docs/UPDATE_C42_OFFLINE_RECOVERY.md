# C42 – uchování posledního balíčku a kontrolovaná obnova

Před aplikací nové verze se na běžné instalaci Velopack pokusí
najít **plný `*-<předchozí-verze>-full.nupkg`** balíček v lokální
složce `packages`. Pokud existuje a je validní ZIP s nuspec,
zkopíruje se mimo vyměňovaný adresář `current` do lokální
uživatelské složky `MSFS Companion/recovery`.
Uloží se velikost, verze, čas a SHA-256. Před obnovením
se znovu ověří integrita balíčku. Ztracené, neplatné nebo
pozměněné balíčky systém **nepoužije**.

Nabídka u hodin obsahuje položku
**Obnovit předchozí verzi (pokročilé)…**. Obnova vyžaduje
výslovné potvrzení člověka; vypne automatické aktualizace
a požádá nativní Velopack `Update.exe apply --package`
o instalaci zachovaného plného balíčku. Nepoužívá
vlastní kopírování DLL/binárek přes aktuální instalaci a
neovlivňuje FlightSimulator.exe.

Není-li validní balíček zachovaný, nabídka pouze doporučí
ruční instalátor z GitHub Releases. Plná kopie zůstává
zabezpečená pouze integritním hashem z původní lokální
instalace; to **není digitální podpis vydavatele**.

**Důležité omezení:** Zatím stále nejde o automatický
rollback při úplném selhání Windows hostitele. Pokud
se host vůbec nespustí, nabídku nelze otevřít.
Nezávislý watchdog a test záměrně poškozené instalace
na skutečném Windows počítači budou vyžadovat další
samostatný krok. Není vhodné zapínat neotestovaný
proces, který by automaticky měnil spustitelné soubory.
Na CI proběhne sestavení Windows, `--self-test` a
skutečná tichá instalace, nikoli reálné převrácení dvou
nainstalovaných vydání.
