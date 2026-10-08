# C9 – plánování letu ze SimBrief

Na `/flight-plan` lze zadat **SimBrief Pilot ID** (1–7 číslic)
a kliknutím jednorázově načíst poslední OFP ze zdokumentované adresy
`https://www.simbrief.com/api/xml.fetcher.php?userid=…`.
Žádný periodický polling SimBrief ani trvalé ukládání pilot ID neprobíhá.

Bridge funguje jako omezené HTTPS proxy pouze na pevnou doménu SimBrief,
ověřuje číselný pilot ID, omezuje délku odpovědi na 4 MB a timeout na 10 s.
Frontend z XML vyčte origin/destination, route a GPS souřadnice navlogu,
nejvýše 400 waypointů. Platné body uloží do **sessionStorage** pro daný
prohlížeč. Při návštěvě `/map` se zobrazí jako ručně importovaný plán,
oddělený od živých GPS waypointů a proletěné stopy.

Funkce **nepřenáší trasu do MSFS**. Nelze z ní odvodit aktivní flight plan
letadla a nesynchronizuje se automaticky při regeneraci OFP. Kontrola v MSFS
2020 proběhne až v reálném provozu. Import dat slouží k prohlížení.
