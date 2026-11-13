# Freunde Einladen und Empfehlungen

Jedes Profil hat eine **Freunde einladen**-Karte mit einem persönlichen Einladungslink. Wenn jemand Goton über deinen Link öffnet und eine Wallet verbindet, wird diese Wallet dir gutgeschrieben. Die Zuordnung erfolgt **off-chain und per Erstkontakt (First-Touch)**, kostet also kein Gas und braucht keine Signatur.

---

## Dein Einladungslink

Öffne dein eigenes Profil und finde die **Freunde einladen**-Karte. Sie zeigt:

- **Deinen Einladungslink** — `https://goton.fun/?ref=<dein-benutzername>`, mit dem Benutzernamen deiner Wallet (z. B. `aerobrassgriffin-79c8`). Eine Wallet-Adresse funktioniert ebenfalls; der Benutzername ist nur leichter zu lesen und zu teilen.
- **Referred** — wie viele Wallets du bisher empfohlen hast.
- **Link kopieren** — kopiert den Link in deine Zwischenablage.

Derselbe `?ref=`-Code wird automatisch angehängt, wann immer du etwas aus Goton heraus teilst — siehe [Wohin dein Link reist](#wohin-dein-link-reist).

---

## Wie die Zuordnung Funktioniert

- **Erstkontakt.** Der erste Einladungslink, den ein Besucher öffnet, zählt. Er wird in seinem Browser gemerkt, bis er eine Wallet verbindet, und ein späterer Link **überschreibt** ihn nicht.
- **Eine Wallet, einmal.** Wenn der Besucher eine Wallet verbindet, wird diese deinem Link genau einmal zugeordnet. Erneutes Verbinden oder das spätere Öffnen eines anderen Links ändert nichts.
- **Keine Selbstempfehlung.** Den eigenen Link zu öffnen und die eigene Wallet zu verbinden, zeichnet nichts auf.
- **Benutzername oder Adresse.** Ein `?ref=`, das ein Benutzername ist, wird vor der Aufzeichnung zur Wallet des Empfehlers aufgelöst; ein Empfehler, der nie gehandelt oder gelauncht hat, lässt sich möglicherweise nicht per Name auflösen — dann ist ein Link mit Adresse die zuverlässigste Form.

Da die Zuordnung per Erstkontakt und off-chain erfolgt, kann ein Missbraucher höchstens einen kosmetischen Zähler aufblähen. Der Zähler ist heute informativ — es sind noch keine On-Chain-Belohnungen damit verknüpft.

---

## Wohin dein Link reist

Dein Empfehlungscode wird den Links hinzugefügt, die du aus der App teilst, sodass das Teilen deiner Aktivität auch dein Netzwerk vergrößert:

| Aktion                             | Was geteilt wird                                             |
| :--------------------------------- | :----------------------------------------------------------- |
| **Profil teilen**                  | Ein Link zum Profil mit dem `?ref` deiner verbundenen Wallet |
| **PnL-Karte teilen**               | Der Link deiner `/pnl/…`-Karte mit `?ref`                    |
| **Auf X teilen** von Token / Trade | Der Link der Token-Seite mit `?ref`                          |
| **Einen Call** oder Beitrag teilen | Der `/post/…`-Link mit `?ref`                                |

In allen Fällen ist der Code der der **verbundenen** Wallet — der teilenden Person — sodass das Teilen des Profils einer anderen Person dir trotzdem gutgeschrieben wird.

---

## FAQ

**Verdiene ich heute etwas mit Empfehlungen?** Noch nicht. Der Zähler ist vorerst kosmetisch. Wenn Belohnungen eingeführt werden, dürfte die Zuordnung auf einen signierten On-Chain-Auslöser umgestellt werden (etwa den ersten Launch oder Trade des Empfohlenen).

**Kann ich ändern, wer mich empfohlen hat?** Nein. Der Erstkontakt ist dauerhaft, sobald eine Wallet verbunden ist.

**Mein Link nutzt meinen Benutzernamen — ist er stabil?** Der Benutzername wird aus deiner Wallet-Adresse abgeleitet, ändert sich also nie.
