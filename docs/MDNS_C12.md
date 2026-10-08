# C12 – Volitelný mDNS název v LAN

Aplikace nadále vystupuje pod názvem **MSFS Companion**.
Název GitHub repozitáře, Windows EXE a Velopack instalačního balíčku,
ikony, titulky webu, lokální složka nastavení i aktualizační feed
zůstávají beze změny.

## Windows nastavení

V tray nabídce Windows:
- **mDNS: kokpit.local** – standardně zapnuto; lze vypnout.
- **Změnit mDNS název…** – vyberte jiný krátký název, například
  `simdeck` nebo `letadlo-2`. Přípona `.local` se přidává sama.
- **Zkopírovat adresu dashboardu v LAN** – preferuje inzerovanou
  adresu, při nedostupnosti mDNS ponechá IP adresu.

Výchozí adresa: `http://kokpit.local:8765/admin`.
Po změně na `simdeck`: `http://simdeck.local:8765/admin`.

Název smí obsahovat 1–63 ASCII znaků: malá a velká písmena
(ukládají se malá), číslice a spojovník uvnitř názvu. Tečky,
mezery a už zadaná přípona `.local` se odmítají.
Při neplatném historickém záznamu se vrátí výchozí `kokpit`.
Nastavení se ukládá do dosavadního
`%LOCALAPPDATA%/MSFS Companion/settings.json` jako `MdnsName`
a `MdnsEnabled`.

Po změně aktivního mDNS názvu se restartuje pouze lokální bridge
a znovu se publikuje A/SRV záznam mDNS. Samotný MSFS zůstává spuštěný.
Je-li mDNS vypnuté, změna názvu pouze uloží nastavení; opětovné
zapnutí publikuje novou adresu.

## Technická stránka

Windows host inzeruje pomocí mDNS/DNS-SD:
- zvolenou adresu `<název>.local` na aktuální privátní IPv4 LAN;
- `MSFS-Companion._http._tcp.local`, port TCP 8765;
- TXT `path=/admin` a `product=MSFS Companion`.

Bridge povolí HTTP `Host` pro zvolené `<název>.local` pouze
po explicitní konfiguraci důvěryhodným Windows hostitelem.
Stávající omezení na lokální privátní podsíť, validační kontroly
Origin a pevný allowlist ovládacích akcí zůstávají.

mDNS vyžaduje multicast UDP 5353 (224.0.0.251) mezi Windows
a iPadem/Macem. Při blokování routerem, firewallem nebo izolací
Wi-Fi klientů je stále dostupná původní
`http://<LAN_IP_PC>:8765/admin` (TCP 8765).

Základní implementace zatím automaticky nedetekuje kolizi
se stejným názvem na jiné stanici v LAN; při konfliktu změňte
mDNS název ve Windows nastavení na unikátní. Není to
veřejná DNS doména ani přístup přes internet.

## Kontrola

1. Na Windows otevřete tray nabídku a ověřte `mDNS: kokpit.local`.
2. Na iPadu/Macu otevřete `http://kokpit.local:8765/admin`.
3. Změňte název na `simdeck`; ověřte `http://simdeck.local:8765/admin`.
4. Ověřte funkční původní LAN IP a PFD/WebSocket.
5. Vypněte mDNS, ověřte fallback přes IP; opět zapněte.
6. Zkontrolujte `windows-host.log` při potížích s UDP 5353.

Windows CI ověřuje konstrukci mDNS A/SRV záznamů,
normalizaci názvů a přijetí pouze nakonfigurované
HTTP Host hlavičky. Skutečný multicast na domácí LAN
je potřeba ještě prakticky vyzkoušet.
