# C7 – Cockpit Systems

Na `/controls` přibylo ovládání **přistávacích, taxi, NAV, beacon a strobe
světel**, pitot heat, parkovací brzdy, klapek, trimu a podvozku.
Používají se dokumentované SimConnect Key Events a pevný allowlist.
Vstupní hodnoty kontroluje stejná služba jako C1/C2; defaultní důvěryhodná
LAN nevyžaduje párování, volitelnou ochranu lze zapnout lokálně.

Readback `GET /api/cockpit/systems` čte světla, pitot a parkovací brzdu z
oddělené 1Hz subscription. Není-li dostupný, zobrazí se neznámý stav –
stisk tlačítka sám o sobě **neznamená potvrzení z MSFS**.
Klapky, podvozek a trim mají stále jen obecné chování; u add-onů může být
potřeba specifický profil a u trimu omezení opakovaných kliknutí.

Při testování zkontrolovat C172 a XCub na zemi, s vypnutým a zapnutým MSFS;
každé tlačítko ověřit přímo v simulovaném kokpitu. Nepodporované systémy
nepoužívat. Letové a bezpečnostně kritické prvky ovládat jen uvnitř simulátoru.
Ovládání není určeno pro skutečné letadlo.

Převzaty jsou pouze veřejně zdokumentované názvy SimConnect Events,
nikoli AGPL Python/JavaScript implementace externích aplikací.
