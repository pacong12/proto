# Anti-Snipe- und Fair-Launch-Schutz

Eine der größten Frustrationen im Krypto-Trading ist, frühe Chancen an automatisierte Sniper-Bots zu verlieren, die die Pool-Liquidität innerhalb von Millisekunden aufkaufen.

Goton integriert fest codierte Smart-Contract-Regeln während der ersten Blöcke eines Launches, damit gewöhnliche Community-Mitglieder eine faire Chance zur Teilnahme haben.

---

## Wie es Funktioniert

Goton verwendet eine **dynamische, abklingende Sniper-Gebühr** in seiner Bonding-Curve-Architektur:

- In der exakten Sekunde des Launches ($t=0$) gilt eine automatische Steuer von 99 % für jeden räuberischen Bot, der eine sofortige Ausführung versucht.
- Die Gebühr klingt in den nächsten 3 Sekunden schnell ab ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Innerhalb von Sekunden setzt der normale, steuerfreie Handel für menschliche Trader reibungslos ein.

---

## Transparenz- und Sicherheitsgarantien

- **Keine Whitelists oder Gatekeeper**: Jeder mit einer Web3-Wallet kann teilnehmen, sobald das Fair-Launch-Fenster öffnet.
- **Keine Admin-Schalter**: Die Anti-Snipe-Limits sind mathematisch fest im Vertrag codiert und laufen ohne menschliches Eingreifen aus.
- **Verkauf immer möglich**: Es gibt keine künstlichen Sperren oder Abhebungs-Wartezeiten für von Nutzern gekaufte Tokens.
