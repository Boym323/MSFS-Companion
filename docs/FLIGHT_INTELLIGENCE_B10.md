# B10 – Flight Intelligence nad záznamy letů

Analýza na `/flights` vzniká **lokálně v prohlížeči** z historie B5.
Neodesílá žádné příkazy do MSFS, nevyžaduje síťové služby ani
další rychlou SimConnect subscription.

## Nové záznamy

Flight Recorder doplňuje do každého nového bodu dva **volitelné**
údaje ze samostatné B6 subscription: `altitudeAglFeet` a `onGround`.
Zapíšou se jen pokud je vzorek mladší než 3 s a z odpovídajícího zdroje.
Při výpadku systémové telemetrie zůstávají null. Existující JSONL
s původními poli se čtou beze změn (volitelné údaje jsou null).

## Pravidla

- `onGround=true` značí zemi **podle SimVar**, ne fyzikální potvrzení.
- Přiblížení je odhad při `onGround=false`, AGL pod 1500 FT,
  IAS nad 45 KT a VS pod -200 FT/MIN.
- Stoupání: VS nad +300 FT/MIN, klesání: pod -300 FT/MIN.
- Vzlet/kontakt se zemí vyžadují **dva sousední vzorky před**
  a **dva po** změně `onGround` v souvislém úseku nejvýše 30 s.
- Důležité úseky stoupání, klesání a přiblížení se vykazují
  až po 15 sekundách trvání.
- Velké časové mezery nad 30 s se nepočítají jako souvislý let.
- Časy jsou orientační, zvlášť u letů převzorkovaných na 4000 bodů.

Neposkytujeme skóre kvality přistání ani absolutní potvrzení touchdowu:
plovákové podvozky, některé mody nebo pauza simulátoru mohou dodávat
nesprávné SimVars. Staré lety bez `onGround` nevytvářejí události
vzletu ani kontaktu se zemí.

## Reálný test

1. Ve výchozím XCub Floats na zemi ověřte `/api/aircraft/systems`
   a `onGround=true`, pak vzlétněte a porovnejte přepnutí.
2. Přibližte se z výšky pod 1500 FT AGL s klesáním a ověřte
   přibližný segment `Přiblížení`.
3. Přistaňte na vodě a sledujte `onGround`; pokud MSFS hodnotu
   nepřepíná, nemá být na dashboardu falešná událost přistání.
4. Otevřete `/flights`, zkontrolujte časovou osu a mock štítky.
5. Opakujte na C172 na dráze. Přepnutí do menu či výpadek spojení
   nesmí automaticky vytvořit přistání.

Automatické testy pracují se syntetickými daty; skutečné letové
vlastnosti ověřuje pilot v simulátoru.
