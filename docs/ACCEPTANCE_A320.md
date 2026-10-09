# Primární akceptační profil – Airbus A320 v MSFS 2020

Kokpit má A320 jako **primární testovací letadlo**. Původní
C172/G1000, TBM930/G3000 a XCub zůstávají volitelné regresní profily.
Zdejší scénáře předpokládají pouze základní vlastnosti Airbusu,
dokud pilot neurčí konkrétní implementaci:

- výchozí Asobo A320neo,
- FlyByWire A32NX,
- Fenix A320,
- jiná doplňková A320.

Jednotlivé implementace mají odlišný způsob interního řízení.
Standardní SimConnect autopilot/GPS SimVars mohou být dostupné,
neúplné, neaktuální nebo neodpovídat stavu custom avioniky.
Neexistuje společná garantovaná sada Input Events pro všechny varianty.

## Příprava zkoušky

1. Na Windows spustit MSFS 2020 a konkrétní A320, potom Kokpit.
   Zaznamenat `/api/aircraft/profile` a přesný SimConnect `TITLE`
   (včetně zdroje/addonu a verze), vydání Kokpitu a čas testu.
2. Na `/aircraft`, `/map` a `/validation` ověřit, že zdroj je
   **simconnect + connected**, nikoli mock, a telemetrie není stale.
3. **Neslibovat dálkové ovládání FCU/MCDU.** Aktuální profil
   `airbus` v `AircraftProfileResolver` má
   `Verified=false`, `Airliner FMC/FCU` a kandidátní panely
   `pfd/map/radio/airliner`. Samostatná A320 FCU/MCDU integrace
   není doložena. Výstupy Cockpit Commands je nutné porovnat
   se skutečným stavem v simulátoru, jinak zůstávají
   `SENT / UNVERIFIED`.

## Testy – hlavní cockpit a průběh letu

| Test | Postup v MSFS 2020 | Kritérium PASS |
|---|---|---|
| Telemetrie | Porovnat výšku, IAS/TAS/GS, směr, stoupání/klesání během letu i na zemi | Čísla odpovídají reálné avionice s vysvětlenými jednotkami, nejsou zamrzlá |
| FCU heading / altitude / speed | Na FCU ručně změnit selected hodnoty a managed/selected režimy | Kokpit odlišuje potvrzenou telemetrii od nepodporovaných/stale údajů; nepředstírá potvrzené řízení FCU |
| AP1/AP2 / FD / A/THR | Ručně zapnout a vypnout dostupné režimy, sledovat annunciace na PFD/FMA | Kokpit zobrazuje jen hodnoty, které daná A320 skutečně poskytuje; neodhaduje je z generických přepínačů |
| MCDU flight plan | Naprogramovat trasu se známými body, porovnat aktivní leg s navigací `/map` | Rozdílné souřadnice či pouze identický identifikátor nejsou falešně deklarované jako úplná shoda |
| ND vs moving map | Na ND sledovat aktuální bod, polohu a směr, měnit trasu během letu | Bezpečně rozlišeno GPS readback a importovaný PLN/SimBrief; bez zápisu do avioniky |
| Rádio a XPDR | Na Airbusu změnit frekvence a transponder | Live readback souhlasí, při nepodporované hodnotě je stav označen jako neověřený |
| Motor, APU, palivo | Za studena/po startu porovnat motory a palivové údaje, volitelně APU | Žádná nedostupná SimVar není vydávána za skutečně 0 |
| Odejmutí SimConnectu / změna letadla | Simulátor odpojit a znovu připojit; změnit profil | Stale stav zmizí, data nového TITLE nezdědí starý profil |
| Přistání a záznam letu | Ověřit přistání, logbook a export JSON | Při známých hodnotách odpovídá touchdown, po ukončení vznikne dokončený a obnovitelný archiv |
| Restart bridge během letu | Restartovat pouze Kokpit/bridge na zemi či v neškodné části simulace | MSFS se nevypne, spojení se obnoví a neztratí již potvrzená data |

Každou zkoušku označit `PASS / FAIL / INCONCLUSIVE` a poznamenat,
zda byla hodnota **přečtena**, událost **odeslána** nebo účinek
**ověřen pozorováním**. HTTP 202, enumerovaný název Input Event,
shoda názvu letadla ani samostatný green CI nejsou potvrzení
funkční podpory Airbus FCU.

Pokud jde o FlyByWire A32NX či Fenix A320, další implementaci
FCU/MCDU navrhovat teprve po ověření dokumentovaných addon
rozhraní a jejich licenčních podmínek. Bez konkrétní varianty
nepřidávat kódem neověřené H-Events nebo L-Variables.

### Otevřené závislosti

- [#20](https://github.com/Boym323/MSFS-Companion/issues/20):
  skutečné SimVars a touchdown.
- [#24](https://github.com/Boym323/MSFS-Companion/issues/24):
  GPS a waypointy.
- [#23](https://github.com/Boym323/MSFS-Companion/issues/23):
  avionické Input Events; G1000 je nyní pouze doplňkový regresní profil.

Windows rollback test [#19](https://github.com/Boym323/MSFS-Companion/issues/19)
zůstává nezávislý na konkrétním modelu letadla. Neprovádět jej
během letu.
