# A320-09 až A320-11 – Asobo A320neo FCU integrace (bez displejů)

**Cíl:** MSFS 2020 default Asobo A320neo V1. Druhé kolo přinese PFD/ND/ECAM/MCDU displeje.

## Implementace kola 1

- Původní 20Hz PFD běží nezávisle na 1Hz Airbus subscriptions. Při dokončení/selhání engine, FCU nebo APU/fuel readeru se daný reader sám obnovuje po 5 s bez restartu PFD.
- Asobo A320 je rozpoznáván kandidátně z čerstvého TITLE; generace identity se mění s každým reconnectem.
- Dedikované Key Events pro reference: SPD (100–350 kt), MACH (0.10–0.95/0.01), HDG (0–359°), ALT (100–49000 ft/100), V/S (-6000 až 6000 ft/min/100).
- Bez potvrzení aktivace na Windows PC jsou příkazy vypnuté. Aktivace je nejvýše na 30 minut, pro jedno TITLE a generaci SimConnect. Údaje FCU musejí být čerstvé do 3 s.
- API hlásí odeslání pouze jako „sent_unverified“. Následný readback je „pending“, „simvar_observed“ nebo „unconfirmed“; není tvrzením o skutečném FCU nebo FMA.
- Samostatný ovládací panel na /a320 je po aktivaci dostupný z iPadu i notebooku. Žádné AP engage/disengage, managed/selected, AP1/AP2, FMA či MCDU zapisování není odblokováno.
- Stávající bezpečnost LAN, origin check, případné párování a limit příkazů 250 ms zůstávají.

## Omezení technologie a další krok

Asobo A320 V1 používá i vlastní H:A320_Neo_* události a LVars. Běžné SimConnect Key Events nepotvrzují ovládání skutečných knobů, push/pull managed/selected, AP1/AP2 nebo MCDU. MSFS 2020 může mít navíc různé možnosti Input Events podle vydání. K plné integraci specifických FCU funkcí bude třeba funkční in-sim WASM modul a ověření přímo v MSFS; nelze bezpečně odhadovat názvy a účinky událostí. Takový modul musí být distribuován jako součást Kokpitu a instalován se souhlasem pilota, nikoliv jako další trvale běžící software na Windows.

## Manuální acceptance – skutečné MSFS 2020

1. Spustit default Asobo A320neo V1 a 15 minut kontrolovat PFD, engine/FCU/APU, počet reconnectů.
2. V počítači se simulátorem otevřít http://127.0.0.1:8765/a320 a povolit testovací režim na zemi.
3. Vyzkoušet pět referencí jednotlivě; porovnat skutečnou FCU hodnotu a SimVar. „simvar_observed“ nestačí k PASS.
4. Změnit letadlo, vypnout a znovu zapnout MSFS; příkazy musí opět být zamčené.
5. Ověřit samostatnou obnovu 1Hz readerů bez přerušení 20Hz PFD.
6. Každý test označit PASS/FAIL/INCONCLUSIVE, záznam případných chyb pořídit přes /health.

Zdroje:
- https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Aircraft_Autopilot_Flight_Assist_Events.htm
- https://docs.flightsimulator.com/html/Content_Configuration/Models/ModelBehaviors/TemplateExplorer/Asobo/Common/Autopilot.html
