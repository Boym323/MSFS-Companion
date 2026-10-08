# C22 – Aircraft Compatibility Lab

Rozšíření stávající `/capabilities`: zobrazujeme čas poslední enumerace SimConnect Input Events, shodu aktuálního TITLE a názvu enumerovaného letadla a explicitní stav `offline`, `aircraft_changed`, `scan_stale`, `scan_failed`, `no_input_events` nebo `enumerated`.

**Enumerované tlačítko neznamená prokázaný účinek v simulátoru.** Žádný automatický test neposílá povely. Toto rozlišení zůstane viditelné i při úspěšných CI testech. Testy pokrývají odpojení, změnu letadla a zastaralá data.
