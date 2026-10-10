# A320 WASM: automatické ověření a diagnostika

## Proč se dříve zobrazovalo „NEOVĚŘENO“

Starý backend nastavoval `moduleReady` pouze po ručním `POST /api/a320/wasm/probe`
a zapomněl ACK za 90 sekund. Web pak zobrazoval `WASM NEOVĚŘENO` bez rozdílu,
zda simulátor neběží, modul se právě ověřuje nebo skutečně neodpovídá.

## Nový heartbeat

- `A320WasmHeartbeatService` běží ve stávajícím Windows bridge.
- Každých **15 sekund**, jen při živém MSFS SimConnect spojení a důvěryhodné
  identitě původního Asobo A320neo V1, odešle **pouze opcode 0** přes
  existující ClientData/WASM protokol. Jde o bezpečný ping bez zásahu
  do kokpitu, ne H-event.
- Po ACK se `moduleReady=true` a zobrazí **WASM OK**; potvrzení je platné
  maximálně 45 sekund a pravidelně se obnovuje.
- Při výpadku připojení, ztrátě důvěryhodné identity, změně TITLE
  nebo nové generaci SimConnect se dřívější ACK **okamžitě zneplatní**.
  Případná pozdě doručená odpověď starého pingu se ignoruje.
- Zjišťování neběží při nepřipojeném simulátoru, nespoléhá na
  FCU readback a nepovoluje ovládání automaticky. Původní explicitní
  autorizace a 30minutové armování zůstávají beze změny.
- Výpadek optional WASM modulu nesmí zastavit celý bridge.
- Ruční tlačítko `Ověřit WASM` zůstává dostupné na Windows localhost,
  používá však stejný stavový automat jako automatický ping.

## Přesné stavy

| Stav API | Web | Význam |
|---|---|---|
| `waiting_sim` | ČEKÁ NA MSFS | SimConnect není živě připojen |
| `waiting_aircraft` | ČEKÁ NA A320 | Není potvrzena identita původního Asobo A320neo |
| `checking` | OVĚŘUJI | Čeká se na první/novou odpověď |
| `connected` | OK | Čerstvý ACK pro současnou identitu a generaci |
| `unavailable` | BEZ ODEZVY | Poslední ping vypršel bez ACK |
| `error` | CHYBA | SimConnect/native chyba nebo jiný neúspěch |

### GET /api/a320/wasm/status

Kompatibilní pole `moduleReady`, `ready`, `armed`, `fcuFresh`,
`local`, `moduleProtocolVersion`, `actions`, `lastError`, `note`
jsou zachována. Nově přibyly:

```json
{
  "state": "connected",
  "autoProbe": true,
  "probeIntervalSeconds": 15,
  "lastAckUtc": "2026-10-10T16:00:00+00:00",
  "lastProbeUtc": "2026-10-10T16:00:00+00:00",
  "lastProtocolStatus": 1
}
```

Uvedená data jsou jen ilustrační. Opravdové hodnoty jsou pouze
z live odpovědí bridge.

`moduleProtocolVersion` udává očekávanou verzi protokolu v bridge;
**neověřuje verzi balíčku na disku**. Pozitivní ACK neprokazuje
správný účinek H-eventů v originálním Airbus FCU.

## Ověření ve Windows

1. Ujisti se, že WASM balíček je nainstalovaný přes Windows tray do
   MSFS 2020 `Community` a že byl MSFS po instalaci restartován.
2. Otevři `/a320` na PC nebo iPadu. Po navázání identifikovaného
   MSFS spojení se bez další akce během nejvýše 15 s (plus doba pingu)
   ověří WASM.
3. Rozbal `Diagnostika WASM` a podívej se na stav, poslední ping,
   ACK, očekávanou verzi protokolu a chybu.
4. Pokud se ukáže `BEZ ODEZVY`, zkontroluj cestu Community,
   restart MSFS, verzi balíčku a simconnect logy. Vlastní
   zásah do FCU není součástí tohoto automatického testu.
5. Pokud se ukáže `ČEKÁ NA A320`, řeš nejprve živé rozpoznání
   stock Asobo A320neo, ne reinstalaci WASM.

Automatický heartbeat nesmí spustit AP, A/THR, EFIS nebo MCDU událost.
