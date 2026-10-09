# A320-02/03 – Airbus Asobo A320neo read-only SimConnect

Základní 20Hz PFD zůstává nedotčený. Nové samostatné a
volitelné 1Hz subscriptions jsou aktivní pouze když
`AircraftProfileResolver` kandidátně rozpozná `a320-asobo-candidate`.
Neexistuje žádný přidaný software do Windows ani nové write API.

## API

`GET /api/aircraft/airbus/a320/status` – read-only;
vrací `connected`, `profileId`, `verifiedAircraft=false`,
`mode=read_only`, `fmaVerified=false`, `engines`,
`fcu`, stáří snímků a varování.

- Engine 1/2: `TURB ENG N1:index`, `TURB ENG N2:index`
  (percent), `TURB ENG FUEL FLOW PPH:index`
  (pounds/hour). Dva motory nezávisle, ne `GENERAL ENG RPM:1`.
- FCU reference: selected airspeed (knots), Mach,
  heading (degrees), altitude (feet), vertical speed (ft/min);
  hrubé `AUTOPILOT SPEED/HEADING/ALTITUDE/VS SLOT INDEX`
  a master AP. **SLOT INDEX je zde pouze raw simulator reference**,
  nikoli potvrzený Airbus FMA, managed/selected ani AP1/AP2.
- Neplatné snímky se odmítají, 6 s staré snímky se skrývají
  jako `null`. FCU a motory mají nezávislé odběry,
  takže selhání jednoho nezastaví PFD ani druhý.
- Při změně TITLE/odpojení se resetují všechny readbacky.
  Neověřená identita nebo jiné letadlo vrací `null`.

SDK:
- https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_Engine_Variables.htm
- https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Aircraft_SimVars/Aircraft_AutopilotAssistant_Variables.htm

CI ověřuje dvojici motorů, nezávislé age limity,
invalidní FPS/sloty a že addon nezdědí snapshoty Asobo.
**K dosažení pilotního PASS je stále nutné skutečné MSFS 2020
s původním Asobo A320neo**: zda všechny SimVars vracejí
odpovídající hodnoty a ne pouze defaultní nuly.
