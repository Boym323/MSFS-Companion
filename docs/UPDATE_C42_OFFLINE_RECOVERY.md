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

**Aktuální stav:** Nezávislý recovery watchdog je již
implementovaný jako **experimentální opt-in (default OFF)**,
viz [C42 watchdog](UPDATE_C42_WATCHDOG.md). Jeho spuštění
vyžaduje SHA256-ověřený celý balíček přesně předchozí verze;
pokud chybí nebo se supervisor nespustí, aktualizace se
zapnutou ochranou vůbec nezačne. Hostitel, bridge ani MSFS
se při nezdařeném požadavku nesmějí násilně ukončit.

Samotný destruktivní test A→B→A se selháním nové instalace
zatím na skutečném Windows dokončený není. CI ověřuje sestavení,
self-test a nativní instalaci, nikoli tento scénář.
Před produkčním povolením automatického rollbacku postupujte
podle [akceptačního protokolu](STABILIZATION_ACCEPTANCE.md).
