# Pravidla projektu MSFS Companion

## Jazyk dokumentace

**Veškerá uživatelská, vývojářská a provozní dokumentace projektu musí být česky.**
Platí to pro `README.md`, všechny soubory v `docs/`, návody k instalaci,
popisy postupů i nové texty pro administrátory.

- Názvy API, knihoven, příkazů, proměnných a skutečné názvy položek externích
  nástrojů ponechávejte v originále, pokud by jejich překlad znepřesnil návod.
- Změny funkcí průběžně promítněte do české dokumentace ve stejném PR.
- Webové uživatelské rozhraní a Windows nabídky mají být česky.
- Krátké komentáře v kódu mohou používat ustálené technické termíny;
  text dokumentace však musí být česky.
- U bezpečnostních omezení rozlišujte skutečně implementované funkce
  od plánovaných a nikdy neuvádějte neověřenou funkčnost jako hotovou.

## Bezpečnost aktualizací

Správcovské příkazy musí vyžadovat autorizaci. Bridge má ve výchozím stavu
poslouchat pouze na `127.0.0.1`; pro přístup přes internet používejte pouze
ověřený soukromý tunel, nikdy otevřený nechráněný port ani Tailscale Funnel.
Aktualizace mohou restartovat MSFS Companion, nikdy však přímo simulátor.
