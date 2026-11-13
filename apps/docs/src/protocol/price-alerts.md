# Price & Market-Cap Alerts

Set an alert on any token and Goton tells you when it reaches your target. Alerts are tied to your wallet and checked on the server, so they keep watching while the tab is closed and fire the next time you open the app.

---

## Creating an Alert

1. Open a token's **trade** page.
2. Click the **alert bell** in the trade header to open the alerts popover.
3. Choose:
   - **What to watch** — **Market cap** or **Price** (both in USD).
   - **Direction** — **Above** or **Below** your threshold.
   - **Threshold** — the USD value to cross.
4. Create it. The alert needs a connected wallet, because it is stored against your wallet.

You can keep several alerts on the same token — for example "price above $0.01" and "market cap below $50K" at once.

---

## How Alerts Fire

- Goton checks your open alerts **on the server**, continuously, against each token's latest price and market cap — so an alert keeps watching even while your tab is closed.
- An alert fires when the value crosses in its direction: an **above** alert at or over the threshold, a **below** alert at or under it.
- When you open the app, it shows a notification for any alert that has newly fired, and the popover marks triggered alerts with a dot. A triggered alert stops watching — create a new one to watch again.

---

## Browser Notifications

In the alerts popover you can **Enable** browser notifications. Once you grant permission, Goton can push a notification to your device the moment an alert fires — even when the Goton tab is closed — and clicking it opens the token. This is opt-in and per browser; turn it off anytime from the same popover. If your browser doesn't support web push, the toggle simply doesn't appear and in-app notifications still work.

---

## Managing Alerts

- The popover lists your open and triggered alerts for the token.
- Remove any alert from the list at any time.
- Alerts are per wallet: connect the same wallet to see them again on another device.

---

## Notes

- Thresholds are **USD** values. A market-cap alert watches the token's fully-diluted USD market cap; a price alert watches its USD price.
- Alerts are a **notification only** — they never place a trade. To act automatically at a price, use [Limit, Take-Profit & Stop-Loss orders](/protocol/advanced-orders) instead.
