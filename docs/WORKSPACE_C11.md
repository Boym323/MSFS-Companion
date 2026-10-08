# C11 – uživatelské rozložení kokpitu

Na `/workspace` lze vybrat nejvýše tři nezávislé panely
(PFD, mapa, detail letadla, ovládání, G1000, další avionika),
měnit jejich pořadí a počet sloupců na širší obrazovce.
Předpřipravené sestavy: Pilot/PFD+Mapa, Navigace a IFR avionika.
Na iPadu se panely automaticky skládají pod sebe.

Sestava je uložena v `localStorage` **konkrétního prohlížeče**,
nikoli na Windows hostiteli, neobsahuje data letu a lze ji resetovat.
Maximálně tři panely zabraňují neomezenému vykreslování velkého
množství PFD/mapových komponent. Všechny panely respektují
stávající dostupnost živé telemetrie. Nejde o nativní MSFS pop-out
display, nýbrž o vlastní webové instrumenty.

Testy kontrolují validaci uložených rozložení (duplicitní a cizí
identifikátory, nepovolené sloupce, prázdná sestava).
Vizuální chování je nutno ověřit manuálně na iPadu a notebooku.
