# Ověření Kokpitu C41–C50 na skutečném MSFS 2020

Automatické testy v GitHub Actions ověřují algoritmy, sestavení,
Windows instalátor, instalovanou verzi Velopacku a lokální
regresní testy. **Neprokazují** odezvu konkrétní avioniky
ani zotavení po úmyslně poškozeném dvouverzovém upgradu.

## A. MSFS 2020 – reálná avionika a GPS

1. Ve Windows spusťte MSFS 2020 a zvolte Cessna 172
   s avionikou G1000; v Kokpitu otevřete `/validation`.
2. Zaznamenejte **před** a **po** změně Heading/FMS,
   Direct-To, Menu a CLR tam, kde jsou Input Events
   skutečně enumerovány. Na `/g1000` ručně označte
   každý ovladač podle odezvy displeje, nikoli podle HTTP
   odpovědi `sent`.
3. Na `/map` importujte odpovídající `.PLN` a
   zkontrolujte aktivní GPS bod, index, ETE a odchylku
   při změně aktivního úseku. Samotný import `.PLN`
   **nikdy nesynchronizuje** G1000.
4. Zopakujte test pro XCub Floats s vodním přistáním
   (zvlášť `onGround` a AGL) a TBM930 s jeho odlišnou
   avionikou. Nesprávné nebo chybějící SimVars označte
   jako `UNKNOWN`, nikoli jako nefunkčnost letadla.
5. Exportujte JSON z `/validation` a uchovejte verzi
   Kokpitu, konkrétní název letadla z `TITLE` a čas testu.
   Export C41 neobsahuje GPS souřadnice. Před sdílením
   zkontrolujte případné osobní údaje v ručních poznámkách.

## B. C49 – obnova vlastní historie

1. Na Windows otevřete `http://127.0.0.1:8765/flights`.
   Stáhněte JSON zálohu. **Obsahuje GPS polohy a časy**.
2. Ukončete právě probíhající let a jeho zaznamenávání.
   Otevřete zálohu v lokálním inspektoru, zatrhněte
   výslovný souhlas a obnovte lety.
3. Ověřte, že původní lety zůstaly v seznamu, obnovené
   lety mají nové ID a jejich trasy lze přehrát.
   Na iPadu je import z bezpečnostních důvodů zakázán.
4. Při nedostatku místa nebo překročení 30 letů/100 MiB
   musí server import odmítnout bez mazání stávajících dat.

## C. C42 – kontrolovaný dvouverzový crash test

**Provádět pouze na izolovaném testovacím Windows účtu
nebo virtuálním počítači, nikoliv uprostřed letu.**

1. Nainstalujte starší známé funkční vydání Kokpitu.
   V tray zapněte experimentální watchdog, potvrďte upozornění.
2. Spusťte řízenou aktualizaci na novější testovací
   vydání s úmyslně znemožněným startem hostitele.
   Nepoškozujte produkční Windows ani soubory MSFS.
3. Zkontrolujte, že se vytvoří ověřený lokální
   `previous-full.nupkg` s SHA-256 a journal cílové
   i předchozí verze.
4. Hlídač nesmí zasáhnout při běžícím Windows hostiteli
   nebo bridge, nesmí opakovat rollback a musí
   deaktivovat automatické aktualizace po pokusu.
5. Ověřte, že staré vydání skutečně znovu naběhne a
   letová historie i nastavení zůstanou beze změny.
   Zaznamenejte verze, kroky, Windows log a výsledek.
6. Vraťte nastavení do bezpečného výchozího režimu.
   Bez zaznamenaného testu neoznačujte C42 za
   produkčně ověřený automatický rollback.

## D. C45 – mapová data a omezení

Kokpit automaticky vybírá poslední **publikovaný a
účinný** `CZ_all_YY-MM-DD.txt` z katalogu Aeroklubu,
podporuje geometrické anotace a varuje při stáří dat.
Žádné OpenAir podklady ale samy neověřují aktivaci
prostoru, AIP doplňky či skutečné NOTAM.
Při reálném letu nepoužívejte Kokpit jako autoritativní mapu.

## Kritéria uvolnění

- C43/C44: ruční PASS/FAIL na konkrétním typu a
  verzi avioniky; žádný automatický PASS z dostupnosti API.
- C49: pozitivní automatické testy obnovy,
  izolace LAN a lokální zápis na Windows.
- C42: nativní Windows CI + skutečný dvouverzový
  crash-injection test se záznamem. Experimentální
  watchdog musí zůstat default OFF, dokud není splněn.
