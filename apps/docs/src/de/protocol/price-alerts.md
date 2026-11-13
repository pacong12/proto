# Preis- und Market-Cap-Benachrichtigungen

Setze eine Benachrichtigung auf einen beliebigen Token, und Goton sagt dir Bescheid, wenn er dein Ziel erreicht. Benachrichtigungen sind an deine Wallet gebunden und werden auf dem Server geprüft, sodass sie auch bei geschlossenem Tab weiter überwachen und beim nächsten Öffnen der App auslösen.

---

## Eine Benachrichtigung Erstellen

1. Öffne die **Trade**-Seite eines Tokens.
2. Klicke auf die **Benachrichtigungs-Glocke** in der Trading-Kopfzeile, um das Benachrichtigungs-Popover zu öffnen.
3. Wähle:
   - **Was überwacht wird** — **Market-Cap** oder **Preis** (beide in USD).
   - **Richtung** — **Über** oder **Unter** deiner Schwelle.
   - **Schwelle** — der zu überschreitende USD-Wert.
4. Erstelle sie. Die Benachrichtigung braucht eine verbundene Wallet, da sie unter deiner Wallet gespeichert wird.

Du kannst mehrere Benachrichtigungen für denselben Token behalten — etwa „Preis über 0,01 $“ und „Market-Cap unter 50 K$“ gleichzeitig.

---

## Wie Benachrichtigungen Auslösen

- Goton prüft deine offenen Benachrichtigungen **auf dem Server**, fortlaufend, gegen den jeweils aktuellen Preis und die Market-Cap jedes Tokens — eine Benachrichtigung überwacht also auch bei geschlossenem Tab weiter.
- Eine Benachrichtigung löst aus, wenn der Wert in seine Richtung überschreitet: eine **Über**-Benachrichtigung bei oder über der Schwelle, eine **Unter**-Benachrichtigung bei oder unter ihr.
- Wenn du die App öffnest, zeigt sie für jede neu ausgelöste Benachrichtigung eine Mitteilung, und das Popover markiert ausgelöste mit einem Punkt. Eine ausgelöste Benachrichtigung hört auf zu überwachen — erstelle eine neue, um erneut zu überwachen.

---

## Benachrichtigungen Verwalten

- Das Popover listet deine offenen und ausgelösten Benachrichtigungen für den Token.
- Entferne jede Benachrichtigung jederzeit aus der Liste.
- Benachrichtigungen sind pro Wallet: Verbinde dieselbe Wallet, um sie auf einem anderen Gerät wiederzusehen.

---

## Hinweise

- Schwellen sind **USD**-Werte. Eine Market-Cap-Benachrichtigung überwacht die (fully-diluted) USD-Market-Cap des Tokens; eine Preis-Benachrichtigung überwacht seinen USD-Preis.
- Benachrichtigungen sind nur eine **Mitteilung** — sie führen nie einen Trade aus. Um bei einem Preis automatisch zu handeln, nutze stattdessen [Limit-, Take-Profit- und Stop-Loss-Orders](/de/protocol/advanced-orders).
