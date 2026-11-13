# Protocol Analytics

The **Analytics** page gives a live, network-wide view of activity on Goton — how much is trading, how many tokens are launching, and the fees the protocol is generating — for the network you're currently on.

---

## The Main Chart

A single interactive chart plots one metric over the **last 24 hours**, in buckets. Switch the metric:

| Metric       | What it plots                     |
| :----------- | :-------------------------------- |
| **Volume**   | Trading volume over time          |
| **Launches** | Tokens launched over time         |
| **Fees**     | Protocol fees generated over time |

Toggle between a **smooth area** and a **bar** view. Everything is scoped to the **active network** (Robinhood or Arc) — switch networks from the header to see the other chain's figures.

---

## Headline Stats

Below the chart, summary cards show the network's totals, including:

- **Total trading volume** — overall volume on the network.
- **Total tokens launched** — how many tokens have been created.
- **Tax / fee estimate** — an estimate of fees generated.
- **Buyback** — protocol buyback activity, when present.

A **top tokens** list ranks tokens by market cap, so you can jump straight from the macro view to a specific token's trade page.

---

## Notes

- Figures are built from **on-chain data** and update as new blocks are processed. Want the same numbers for your own tool? They're in the [Public API](/integration/api).
- Analytics are **per network**: the page always reflects the chain shown in the header, and says so in its scope note.
- Numbers are indexer-derived and update as new blocks are processed; a 24-hour window is a rolling view, not a calendar day.
