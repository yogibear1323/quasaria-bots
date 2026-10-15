# Meet the Quasaria bots

A fun, single static landing page (no build step, no CDNs) explaining the 24 Quasaria trading-floor bots: crypto, forex and the US stock research desk.

**Paper trading only. Nothing here places real orders. Not investment advice.**

- `index.html`, `style.css`, `app.js`: the landing page.
- `portal/`: a frozen **snapshot** of the paper trading floor, styled as a back-office dashboard (the "Enter the Bot Portal" buttons lead here). It reads `portal/state.json`, captured once; it is not live. Views: `#/overview`, `#/floor`, `#/desks`, `#/events`, `#/tokenization`.
- `portal/tokenization.js`: the **Property Tokenization** concept view (illustrative only): deed → SPV → real estate share token on Stellar testnet → Blend lending yield → yield destination (mortgage / income / bills). All numbers are estimates or ASSUMED inputs; addresses are fake placeholders; no network calls, wallets or keys; not an offer or investment advice.

Live site: https://yogibear1323.github.io/quasaria-bots/
