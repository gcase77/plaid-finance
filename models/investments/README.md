# Investments model

Lightweight standalone Plaid model simulating the main app's transactions-first link flow, then adding investments via Link update mode.

- **Initial link** (`POST /api/link/token`): requests `transactions` only (matches main app).
- **Update mode** (`POST /api/link/token/update`): adds `investments` via `additional_consented_products` on an existing Item's `access_token`.
- **Update complete** (`POST /api/link/update/complete`): refreshes Item metadata from Plaid after update mode (no token exchange).
- Portfolio UI with product badges and an "Enable Investments" banner for items without the investments scope.
- SQLite persistence at `models/investments/investments.sqlite`.

## Run

From `models/investments`:

```bash
npm install
npm run start
```

Open [http://localhost:8010](http://localhost:8010).

Sandbox test bank: **First Platypus Bank** — username `user_good`, password `pass_good`.

## Env vars

Uses the same Plaid env vars as your main app:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`
- optional: `PLAID_REDIRECT_URI` (for OAuth institutions)

## What's persisted

- `items`: item id, access token, institution metadata, `consented_products`
- `accounts`: account snapshots
- `holdings`: each holding row + full raw payload
- `securities`: each security row + full raw payload

## Remove bank behavior

`POST /api/items/:itemId/remove`:

- Attempts Plaid `/item/remove`
- Always wipes local DB rows for that bank (`items`, `accounts`, `holdings`, `securities`)
- Returns Plaid unlink status + warning message if Plaid unlink fails
