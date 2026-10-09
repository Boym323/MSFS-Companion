# Stabilization & Acceptance – ověření Kokpitu v MSFS 2020

Tento protokol uzavírá zbytková rizika po etapách C41–C50.
CI/Windows instalátor ověřují build, logiku a základní instalaci,
ale **nejsou důkazem kompatibility skutečných SimVars, Input Events
ani schopnosti vrátit poškozené vydání**.

## 1. Windows Recovery Acceptance – C42, issue #19

**Provádět výhradně na odděleném testovacím účtu nebo kopii/VM Windows,
nikoli během živého letu.** Před zkouškou zálohovat uživatelskou složku
`%LOCALAPPDATA%\MSFS Companion` a vlastní uložené lety.

Připravit dvě skutečná lokální vydání A a B v nativním Velopack formátu.
Ověřit obě jejich čísla i správný celý `*-full.nupkg`; neprovádět
ruční kopírování DLL/EXE do `current`. Experimentální watchdog lze
zapnout pouze na tomto testovacím prostředí.

| Scénář | Požadovaný důkaz |
|---|---|
| A → B, zdravý start | `last-verified-update.json` potvrzuje B po health a web testu, bez rollbacku |
| A → B, B se vůbec nespustí | watchdog provede nejvýše jeden pokus obnovy A, vypne další automatické aktualizace a zůstane zachována historie |
| Poškozený balíček A nebo nesprávná předchozí verze | aktualizace se zapnutým watchdogem se odmítne ještě před zápisem aktualizátorem |
| Watchdog se nepodaří spustit | aktualizace se odmítne, `pending-update.json` se bezpečně zruší |
| B se spustí opožděně, ale platně potvrdí health | nedojde k falešnému rollbacku |
| Hostitel nebo bridge stále běží | žádný force kill, žádný rollback do aktivního recorderu |
| Opakovaný pokus obnovy | bez nekonečné smyčky; max. jeden pokus na cílovou verzi |

Zaznamenat přesná čísla A/B, názvy dostupných balíčků, timestampy
journalů, poslední položky `windows-host.log`, stav historie a výsledek.
**Nespouštět destruktivní test ve skutečné uživatelské instalaci.**
Rollback ponechat **default OFF**, dokud scénáře nejsou potvrzené na
skutečném Windows a odpovídající issue uzavřené.

## 2. MSFS 2020 – SimConnect a avionika, issues #20, #23, #24

**Primární letadlo: Airbus A320.** Všechny základní letecké scénáře
testovat přednostně podle
[Airbus A320 acceptance matrix](ACCEPTANCE_A320.md): PFD/FMA,
FCU, MCDU, ND, GPS, rádiová data, stav simulátoru a logbook.
Testy G1000/G3000/XCub jsou doplňkové regresní scénáře
ostatních profilů, nikoliv podmínka pro hlavní pilotní použití.
Dokud není známá varianta A320 (Asobo/FBW/Fenix),
nepovažovat custom FCU/MCDU Input Events za implementované.



Každý scénář provést s běžícím MSFS 2020 a Kokpitem ve stejné LAN.
Používat dostupné `/validation`, `/aircraft`, `/g1000`,
`/map` a `/flights`. Pro potvrzení účinku Input Eventu **nestačí
stav HTTP 202 ani úspěšná enumerace**.

| Letadlo / profil | Ověření |
|---|---|
| C172 / G1000 (volitelně) | FMS, HDG, NAV, Direct-To, MENU/CLR, 1–12 softkeys dle enumerace; fyzicky pozorovat změny avioniky |
| TBM930 / G3000 (volitelně) | dostupnost správného profilu, aktivní GPS waypoint, režimy autopilota; nepodporované Input Events musí být disabled |
| XCub Floats / G3X (volitelně) | AGL, stav na zemi a na vodě, motor, palivo, klapky; nevyvozovat existenci zatahovacího podvozku |
| Letadlo s GNS430/530 | dostupnost profilu a skutečné přepínání navigace, bez domýšlení podpory |
| Změna letadla za provozu | starý profil a příkazy se nesmějí použít bez nové enumerace |
| Odpojení a návrat SimConnect | stale údaje a neautorizované příkazy se skryjí/zablokují; připojení se obnoví bez restartu MSFS |
| PLN / SimBrief vs GPS | porovnat index, ID i polohu aktivního waypointu, rozpor zaznamenat jako neověřený |
| Vzlet / přistání / restart bridge | rozlišit live a mock, validovat dvojité potvrzení `onGround`, zachování uloženého letu |

U každého testu uložit **sanitizovaný JSON diagnostiky** z `/validation`
(pokud je dostupný), verzi aplikace, přesný TITLE letadla,
čas a manuální výsledek `PASS / FAIL / INCONCLUSIVE`.
Výstup s GPS stopou (/flights backup) je soukromý; nesdílet ho
ve veřejném GitHub issue.

## 3. C49 – zpětná obnova letů

Na lokální Windows adrese `http://127.0.0.1:8765/flights`:

1. Vytvořit obnovitelný archiv z dokončených letů, čerstvě jej
   ověřit a uchovat původní kopii.
2. Obnovit do prázdného odděleného testovacího úložiště. Nová ID,
   stejné body (v mezích exportního převzorkování), žádný přepis
   existujících letů.
3. Ověřit odmítnutí aktivního letu, neplatného ID, více než 4000
   bodů, nedostatečného místa a pokusu o obnovení z jiného LAN
   zařízení.
4. Vyzkoušet syntetický nedokončený batch journal: recorder
   odstraní pouze vlastní nedokončené soubory; cizí metadata odmítne.
   Reálný výpadek napájení musí být samostatná bezpečná zkouška.

## 4. Release sign-off

Před označením vydání za plně ověřené ověřit:

- release tag a commit odpovídají určenému `main`;
- Windows installer build + skutečný silent install v GitHub Actions;
- běžné CI (bridge, web, Windows host) a zálohovací transakční testy;
- npm + NuGet dependency-security audit bez vysokých/kritických nálezů;
- doložený pilotní test SimConnect a recovery na skutečném Windows;
- otevřené issues obsahují explicitní zbývající omezení.

**Systémové limity:** Ověření čerstvosti Aeroklub OpenAir nenahrazuje
aktuální AIRAC, NOTAM a aktivaci vzdušných prostorů. Kokpit
není certifikovaná letecká navigace ani TCAS.
