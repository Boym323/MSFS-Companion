# FlyByWire A32NX a SimBridge – integrace do Companion

## Rozsah

- A32NX má vlastní **kandidátní** profil podle aktuálního SimConnect TITLE.
  Výskyt řetězce A32NX/FlyByWire A320 není důkaz správného aircraft balíčku.
- Samostatná stránka Companion je dostupná na /a32nx v sekci Letadlo.
  Historický /a320 a WASM ovládání Asobo V1 zůstávají beze změny.
- Read-only GET /api/integrations/flybywire kontroluje pouze úspěšnou
  HTTP odpověď na localhost Windows počítače, na kterém běží Companion.
  Není to proxy; neodesílá MCDU klávesy, nečte obsah FMS.
- Web otevírá **oficiální** Remote MCDU FlyByWire do nové záložky.
  Podporuje primární mDNS adresu a alternativní IP/hostname Windows PC
  ze stejné důvěryhodné domácí sítě.
- Mapa, PFD, SimBrief OFP, VATSIM a počasí nadále fungují nezávisle.
  OFP importované do Companion se nezapisuje do letadla.

## Instalace – Windows a MSFS 2020

1. Instalujte A32NX a SimBridge pomocí oficiálního FlyByWire Installeru.
2. Spusťte MSFS 2020, načtěte A32NX, zkontrolujte stav SimConnect LIVE.
3. Spusťte SimBridge. Na flyPadu otevřete Settings → Sim Options,
   SimBridge Connection nastavte na Auto.
4. Na Windows otevřete:
   http://localhost:8380/interfaces/mcdu
5. Na Macu nebo iPadu připojeném k téže LAN otevřete:
   http://simbridge.local:8380/interfaces/mcdu
   Případně použijte privátní IP Windows PC (port 8380).
6. V Companion na /a32nx ověřte, že je A32NX rozpoznané a HTTP status
   odpovídá. V původním MCDU v simulátoru ověřte obousměrnou synchronizaci
   kláves a stránky F-PLN.

Pokud byl port SimBridge změněn, nastavte ve Windows hostiteli Companion
proměnnou MSFS_SIMBRIDGE_PORT (celé číslo 1024 až 65535) a restartujte
hostitele. Neplatné hodnoty použijí port 8380. Samotná proměnná nemění
nastavení SimBridge; port musí souhlasit v obou programech.

Port 8380 ani Companion 8765 nepřesměrovávejte do veřejného internetu.
Ve firewallu Windows případně povolte jen profil Private/LocalSubnet.
Prohlížeč z jiného zařízení musí mít přímé spojení na SimBridge, protože
Companion HTTP ani WebSocket provoz neproxyuje.

## Bezpečnost a technický kontrakt

Backend nikdy nepřijímá host, URL ani port z uživatelského HTTP požadavku.
Volá pevnou adresu 127.0.0.1, vypíná automatické přesměrování i systémovou
proxy a nestahuje tělo odpovědi. Kontrola je povolena jen na Windows
po potvrzení aktuálního SimConnect TITLE a samostatného A32NX profilu.
Žádné neověřené H-Events, LVars, zápisy do SimConnect či automatické povely.

Odpověď GET /api/integrations/flybywire uvádí:
aircraftMatched, aircraft, profileId, simBridgeReachable, checkedOnWindows,
port, remoteMcduPath, fmsSyncVerified=false,
mcduControlByCompanion=false a lastCheckedUtc.

**Pozor:** simBridgeReachable=true pouze potvrzuje dostupnost známé
webové cesty. Neprokazuje správný obsah, skutečnou verzi SimBridge ani
funkční komunikaci s MCDU v simulátoru.

Webové MCDU je oficiální oddělená stránka FlyByWire. Nevkládáme jej
do iframe a neobcházíme CSP, X-Frame-Options, CORS ani interní formát
SimBridge WebSocket zpráv. Vnější webový prohlížeč ovládá skutečné MCDU
prostřednictvím oficiálního SimBridge, nikoliv API Companion.

## Co zůstává nepodporované

- Snímání strukturovaného stavu vnitřního FMS A32NX do Companion
  (INIT, PERF, F-PLN, kompletní SID/STAR).
- Přímé ovládání MCDU ze stránky Companion; tlačítka patří do
  oficiální aplikace FlyByWire.
- Zápis SimBrief plánu do FMS A32NX z Companion.
- Podpora pro Fenix a iniBuilds V2 přes SimBridge.
- Garantovaná funkčnost bez pilotního testu na skutečném Windows PC.

## Akceptační scénáře

- [ ] Zaznamenat přesný TITLE A32NX a GET /api/aircraft/profile.
- [ ] Zkontrolovat GET /api/integrations/flybywire a status na Windows PC.
- [ ] Na iPadu/Macu otevřít oficiální Remote MCDU.
- [ ] Přepnout F-PLN/PROG na iPadu a v simulátoru; ověřit obě strany.
- [ ] Načíst plán SimBrief v A32NX; porovnat s vlastním importem v Companion.
- [ ] Přepnout na původní Asobo V1, iniBuilds V2 a zpět:
      žádné sdílení příkazů ani starých profilů.
- [ ] Odpojit SimBridge, MSFS a SimConnect:
      status se nesmí tvářit jako aktivní FMS.
- [ ] Prověřit 15 minut stability PFD/WebSocket během provozu SimBridge.

## Oficiální zdroje

- https://docs.flybywiresim.com/tools/simbridge/simbridge-feature-guides/remote-displays/remote-mcdu/
- https://docs.flybywiresim.com/tools/simbridge/simbridge-feature-guides/remote-displays/architecture/
- https://docs.flybywiresim.com/tools/simbridge/install-configure/configuration/
- https://docs.flybywiresim.com/aircraft/a32nx/a32nx-api/
