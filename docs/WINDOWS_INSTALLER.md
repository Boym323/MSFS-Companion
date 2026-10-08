# Windows instalace a ovládání v domácí síti

## Základní fungování

MSFS Companion je aplikace pro Windows x64. Po přihlášení běží u hodin,
sama spouští webový bridge a kontroluje novou verzi při startu a každou
hodinu. Vydání se stahují z veřejných GitHub Releases projektu.

**Během aktualizace se restartuje pouze Companion a jeho bridge.**
Microsoft Flight Simulator 2020 zůstane spuštěný, dashboard může
na několik sekund ztratit spojení.

## Instalace na počítači s MSFS

1. Na [GitHub Releases](https://github.com/Boym323/MSFS-Companion/releases)
   stáhněte nejnovější `Boym323.MsfsCompanion-win-Setup.exe`.
2. Nainstalujte aplikaci. Přenosný ZIP nepoužívejte pro automatické aktualizace.
3. V oznamovací oblasti Windows vyberte ikonu MSFS Companion.
4. Přímo na Windows otevřete `http://127.0.0.1:8765/admin`.
5. V nabídce aplikace vyberte **Zkopírovat adresu dashboardu v LAN**.
   Získáte například `http://192.168.1.25:8765/admin`.

Windows hostitel poskytuje web pouze na `localhost` a privátní IPv4
adrese vybraného aktivního Ethernet/Wi-Fi adaptéru. Nepoužívá
`0.0.0.0`, Tailscale, přístupový token ani veřejné síťové rozhraní.

## Jednorázové povolení ve Windows Firewallu

Jestliže adresa funguje na Windows PC, ale Mac se nepřipojí,
zkontrolujte, že jsou oba počítače ve stejné domácí podsíti
a síťový profil Windows je **Soukromá síť (Private)**.

Pouze na svém důvěryhodném domácím PC otevřete PowerShell
**jako správce** a povolte příchozí TCP 8765 výhradně pro
lokální podsíť a profil Private:

```powershell
New-NetFirewallRule -DisplayName "MSFS Companion – domácí síť" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765 -Profile Private -RemoteAddress LocalSubnet
```

Toto pravidlo je potřeba vytvořit jen jednou; platí i po
aktualizacích aplikace. Pokud už odpovídající pravidlo existuje,
nevytvářejte duplicitní. **Nevytvářejte pravidlo pro Public,
nepřesměrovávejte port 8765 na routeru a nepoužívejte UPnP.**

Upozornění: přístup ze zařízení v jiné VLAN/podsíti je v této
jednoduché konfiguraci záměrně odmítnut.

## Ovládání z Macu či tabletu

Na zařízení připojeném ke stejné domácí síti otevřete adresu
zkopírovanou z Windows, například:

```text
http://192.168.1.25:8765/admin
```

Panel **Správa Windows aplikace** automaticky zobrazí stav a verzi.
Klikněte na **Vynutit kontrolu a instalaci nové verze**. Pokud na
GitHubu existuje novější vydání, Windows Companion jej stáhne,
nainstaluje a krátce restartuje. Simulátor zůstane spuštěný.

**Žádný správcovský klíč ani přihlášení se nevyžaduje.**
Zároveň to znamená, že aktualizaci může vyvolat **kterékoliv
zařízení ve stejné důvěryhodné domácí podsíti**. Používejte
proto tento režim pouze tam, kde důvěřujete ostatním zařízením.

Bridge ověřuje IP adresu klienta a hlavičku Host.
Aktualizační příkaz přijme jen s odpovídajícím původem stránky
(`Origin`) a vlastní hlavičkou požadavku; chrání to před
jednoduchým zneužitím z cizích webů. Nejde o přihlášení uživatele.

## Když se web nebo aktualizace nedaří

- Na Windows zkuste `http://127.0.0.1:8765/admin`.
- Ověřte, že Mac je ve stejné podsíti a Windows má profil Private.
- Zkontrolujte pravidlo Windows Firewallu, případně izolaci
  Wi-Fi klientů na routeru.
- Pokud se změnila IP adresa Windows PC, zkopírujte novou
  adresu přes ikonu Companionu; aplikaci případně restartujte.
- Místní log: `%LOCALAPPDATA%\MSFS Companion\windows-host.log`.

Dokumentace je v češtině. Samostatná diagnostika B1 už
prokázala SimConnect, ale produkční bridge stále zobrazuje
**mock telemetrii**; skutečná data připojí etapa B2.

Instalátory jsou zatím nepodepsaná vývojová vydání a není
implementovaný automatický rollback.
