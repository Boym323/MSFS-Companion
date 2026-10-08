# Pravidla projektu MSFS Companion

## Česká dokumentace

Veškerá uživatelská, vývojářská a provozní dokumentace projektu
musí být česky (`README.md`, `docs/`, návody a zprávy o nasazení).
Uživatelské webové a Windows rozhraní také používá češtinu.

Názvy API, příkazů, knihoven a označení externích nástrojů
ponechávejte v originále, pokud jsou potřebné pro přesnost.
Každou změnu funkce doprovází odpovídající aktualizace českého
návodu. Nepotvrzené chování se nesmí vydávat za hotové.

## Provoz pouze v domácí LAN

- Backend se při samostatném spuštění váže na localhost.
- Instalovaný Windows hostitel může přidat konkrétní
  privátní IPv4 adresu aktivního Wi-Fi/Ethernet adaptéru.
- Vzdálené ovládání aktualizací **nevyžaduje správcovský klíč**,
  protože je určeno pro důvěryhodnou domácí podsíť.
- Požadavky musí procházet kontrolou sítě a Host;
  změny stavu navíc kontrolou `Origin` a vlastní hlavičky.
- Neotevírejte port aplikace do internetu a nepoužívejte
  plošné naslouchání na veřejných rozhraních.
- Simulátor se při aktualizaci Companionu nikdy přímo neukončuje.
- Pokud někdy bude potřeba ovládání z nedůvěryhodných sítí,
  musí se znovu zavést autentizace a šifrované spojení.
