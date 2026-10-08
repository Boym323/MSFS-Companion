# Instalace a vzdálená správa MSFS Companion na Windows

## Co instalátor dělá

- Nainstaluje aplikaci pro **Windows x64** a zobrazí ji v oznamovací
  oblasti vedle hodin s vlastní ikonou letadla.
- Ve **Správci úloh** se zobrazí popis **MSFS Companion**.
  Samostatný podproces pro webový backend má popis
  **MSFS Companion Bridge**.
- Po přihlášení do Windows se Companion automaticky spouští
  a hlídá svůj skrytý webový bridge.
- Po spuštění a následně každou hodinu kontroluje aktualizace.
- Aktualizace může krátce restartovat Companion a jeho bridge
  **i během běžícího MSFS**. Simulátor se neukončuje.
- Lokální web otevřete na `http://127.0.0.1:8765/admin`.

## První instalace

1. Otevřete [GitHub Releases](https://github.com/Boym323/MSFS-Companion/releases).
2. U posledního vydání stáhněte `Boym323.MsfsCompanion-win-Setup.exe`.
3. Spusťte instalátor a ověřte ikonu v oznamovací oblasti.
4. Otevřete `http://127.0.0.1:8765/admin` na Windows PC.
5. Pro první vzdálenou správu pokračujte následující kapitolou.

Použijte **Setup.exe**, nikoli `Portable.zip`. Přenosné sestavení
neposkytuje běžný instalovaný aktualizační kanál.

## Vynucení aktualizace z webu

Správce na `/admin` má panel **Správa Windows aplikace**.
Příkazy nejsou dostupné bez autorizace. Pro první spárování:

1. Jednou u Windows počítače klikněte pravým tlačítkem na ikonu
   Companion vedle hodin.
2. Vyberte **Zkopírovat správcovský klíč**. Jde o náhodný 256bitový
   přístupový klíč uložený v profilu aktuálního uživatele.
3. Přeneste klíč **soukromě a bezpečně** do svého Macu, ideálně přes
   správce hesel. Nevkládejte jej do veřejného chatu ani do URL.
4. Na webu `/admin` vložte klíč do panelu, potvrďte **Připojit správu**.
   Pokud je Mac jen váš a důvěryhodný, můžete vybrat zapamatování klíče.
5. Vyberte **Vynutit kontrolu a instalaci nové verze**.

Tím se vyvolá kontrola GitHub Releases na Windows PC. Pokud je
novější verze dostupná, stáhne se a nainstaluje. Stav procesu se
aktualizuje na stránce automaticky. Pokud nová verze není, aplikace
vypíše, že už je aktuální; **nepřeinstalovává stejnou verzi**.

Webový příkaz nepřistupuje přímo do Windows, nevykonává PowerShell
ani neposílá žádné příkazy simulátoru. Backend pouze ověří správce
a předá požadavek místnímu hostiteli.

## Přístup z Macu bez návštěvy Windows PC

Backend zůstává navázán na `127.0.0.1:8765` a není přímo
vystaven lokální síti ani internetu. K bezpečnému přístupu
z dalšího počítače doporučujeme **Tailscale Serve**.
Toto je **jednorázové nastavení**, ne automatická součást instalátoru.

1. Nainstalujte Tailscale na Windows PC i Mac a přihlaste obě
   zařízení do stejné soukromé sítě (tailnet).
2. Na Windows PC jednou spusťte v PowerShellu:

   ```powershell
   tailscale serve --bg http://127.0.0.1:8765
   tailscale serve status
   ```

3. Tailscale zobrazí soukromou HTTPS adresu typu
   `https://pocitac.nazev-tailnetu.ts.net`. Na Macu otevřete
   tuto adresu s cestou `/admin`.
4. Zadejte svůj správcovský klíč a můžete spravovat aktualizace
   bez dalšího přístupu k Windows ploše.

Používejte **Tailscale Serve**, nikdy **Tailscale Funnel** –
Funnel by službu zveřejnil internetu. Provoz musí zůstat omezen
pravidly vašeho tailnetu. HTTPS přenos a autorizovaný přístup
jsou dvě nezávislé ochrany.

Oficiální návod:
[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).

### Bezpečnost přístupového klíče

- Klíč uchovávejte jako heslo. Při zapamatování ve webu
  se ukládá do úložiště příslušného prohlížeče na daném zařízení.
- Nepoužívejte nedůvěryhodné počítače a nesdílejte klíč veřejně.
- V případě kompromitace lze soubor
  `%LOCALAPPDATA%\MSFS Companion\admin-access.token`
  s **ukončenou aplikací** smazat a při dalším spuštění vznikne nový.
  Poté aktualizujte klíč i na správních zařízeních.
- Bridge spuštěný samostatně (například na Macu při vývoji)
  správcovská API vůbec neregistruje.
- Nikdy ručně nepřesměrovávejte port 8765 na internetovém routeru.

## Běžné aktualizace

Zdroj je veřejný repozitář
`https://github.com/Boym323/MSFS-Companion`.

Po schválení a sloučení změn do `main` GitHub Actions sestaví
aplikaci a publikuje novou verzi přes Releases. Nainstalovaný
Windows hostitel ji standardně zkontroluje přibližně 20 sekund
po spuštění a pak jednou za hodinu.

Během aktualizace může dashboard krátce ztratit WebSocket spojení,
ale MSFS pokračuje. Po restartu Companionu se web znovu připojí.

## Diagnostika

Přes nabídku u hodin vyberte **Otevřít diagnostický log**.
Log je také v:

```text
%LOCALAPPDATA%\MSFS Companion\windows-host.log
```

V logu sledujte zejména zprávy o dostupné verzi, stažení nebo chybě.
Z webu lze zobrazit stav, ale podrobný lokální diagnostický log
se kvůli bezpečnosti **neposílá vzdáleně**.

### Omezení vývojového vydání

Instalační balíčky zatím nejsou digitálně podepsané a nemají
automatický rollback. Před přechodem na produkční použití
otestujte skutečný upgrade mezi dvěma verzemi, start po
přihlášení a obnovu po výpadku připojení.

Aktuální bridge stále poskytuje **mock telemetrii**; B2 připojí
skutečný SimConnect. Samotná diagnostika B1 je oddělená aplikace.

Oficiální dokumentace [Velopack](https://docs.velopack.io/packaging/operating-systems/windows).
