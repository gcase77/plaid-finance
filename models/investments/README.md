# Investments model

Lightweight standalone Plaid Investments model:

- Plaid Link flow (`/api/link/token` + `/api/link/exchange`) with OAuth-return resume behavior.
- Two-tab UI:
  - **Banks** tab: `Link bank`, `Remove bank` (with warning/confirm)
  - **Investments Data** tab: `Sync investments + holdings` + payload display
- SQLite persistence at `models/investments/investments.sqlite`.

## Run

From `models/investments`:

```bash
npm install
npm run start
```

Open [http://localhost:8010](http://localhost:8010).

## Env vars

Uses the same Plaid env vars as your main app:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`
- optional: `PLAID_REDIRECT_URI` (for OAuth institutions)

## What's persisted

- `items`: item id, access token, institution metadata
- `accounts`: account snapshots
- `holdings`: each holding row + full raw payload
- `securities`: each security row + full raw payload

## Remove bank behavior

`POST /api/items/:itemId/remove`:

- Attempts Plaid `/item/remove`
- Always wipes local DB rows for that bank (`items`, `accounts`, `holdings`, `securities`)
- Returns Plaid unlink status + warning message if Plaid unlink fails
