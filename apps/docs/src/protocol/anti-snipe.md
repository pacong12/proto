# Anti-Snipe & Fair Launch Safeguards

One of the biggest frustrations in crypto trading is losing early opportunities to automated sniper bots that buy up pool liquidity within milliseconds.

Goton incorporates built-in, hardcoded smart contract rules during the opening blocks of a launch to ensure everyday community members have a fair chance to participate.

---

## How It Works

Goton employs a **dynamic decaying sniper fee** on its bonding curve architecture:

- At the exact second of launch ($t=0$), an automated 99% tax applies to any predatory bot attempting instant execution.
- The fee rapidly decays over the next 3 seconds ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Within seconds, standard zero-tax trading resumes smoothly for normal human traders.

---

## Transparency & Safety Guarantees

- **No Whitelists or Gatekeepers**: Anyone with a Web3 wallet can participate once the fair launch window opens.
- **No Admin Switches**: Anti-snipe limits are mathematically hardcoded into the contract and expire without human intervention.
- **Selling Always Enabled**: There are no artificial lockups or withdrawal cooldowns on tokens purchased by users.
