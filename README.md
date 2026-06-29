### Supabase Email/Password Auth (POC)

- Auth uses email/password with:
  - `supabase.auth.signUp({ email, password })` for new users
  - `supabase.auth.signInWithPassword({ email, password })` for returning users
- Email verification is expected to be disabled in Supabase so new users get a session immediately after sign-up
- Required env vars:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
- For current API-key guidance, check:
  - [https://supabase.com/docs/guides/api/api-keys](https://supabase.com/docs/guides/api/api-keys)

### Transactions Sync Architecture

#### Scheduler function

Orchestrates concurrent processing by atomically locking user items with a time-based expiration to prevent race conditions before dispatching them to the sync worker.

```TypeScript
async function scheduleSyncForUser(userId: string): Promise<void> {
  // 1. ATOMIC LOCKING QUERY:
  //  Perform a single "check-and-set" operation to identify and claim all available items 
  //  (those with an expired or null lock) for this user. 
  //  Transitions them to a "locked" state (now + 5 mins) 
  //  and returns only the IDs that were secured 
  
  // 2. If no items returned, exit.

  // 3. Loop through each locked `item_id`:
      // A. Await syncItemTransactions(userId, item_id).
  
  // 4. FINAL CLEANUP:
  //    Update `items` table for the processed IDs.
  //    SET `transactions_sync_lock_until` = NOW() (Releases lock).
}
```

#### Sync Worker Function

Iteratively synchronizes a single item's transactions via atomic database transactions, utilizing "read-before-write" auditing to capture state inconsistencies and maintaining idempotency through upsert operations.

```TypeScript
async function syncItemTransactions(userId: string, itemId: string): Promise<void> {
  // 1. Initialize variables: cursor, hasMore = true, pageCount = 0.
  //    Define `response` variable here (scope: wide) so the catch block can access it.

  try { 
      // 2. Loop while hasMore is true AND pageCount < MAX_SAFETY_LIMIT:
      
          // A. Fetch 500 transactions from Plaid using current cursor.
          //    Assign to `response`.
          //    If API call fails, throw Error('Plaid API Request Failed').

          // B. Empty Batch Check:
          //    If `added`, `modified`, and `removed` arrays are ALL empty:
          //    Throw Error('Sync returned no transaction updates.');

          // C. START ATOMIC DB TRANSACTION (Prisma Interactive Transaction):
              
              // --- READ (Audit Prep) ---
              // 1. Fetch IDs of existing txns matching `added` batch -> `already_added`.
              // 2. Fetch IDs of existing txns matching `modified` batch. 
              //    Filter Plaid list against DB results -> `modified_not_included`.
              // 3. Fetch IDs of existing txns matching `removed` batch.
              //    Filter Plaid list against DB results -> `removed_not_included`.
              
              // --- WRITE (Idempotent Upserts) ---
              // 4. UPSERT `added` batch.
              // 5. UPSERT `modified` batch.
              // 6. UPSERT `removed` batch (Upsert with is_deleted=true, works for ghosts too).
              
              // --- STATE ---
              // 7. Update cursor & extend lock (+5 mins) in `items` table.
              
              // 8. RETURN object (txResult): 
              //    { successful_update: true, already_added, modified_not_included, removed_not_included }
          
          // D. END DB TRANSACTION (Commit).
    
          // E. LOG SUCCESS (Inside Loop)
          await to_db('INFO', userId, 'TRANSACTIONS SYNC', { 
             ...txResult, 
             itemId,
             transactions_update_status: response.data.transactions_update_status 
          }, response.data);
          
          // F. Update loop variables (cursor, hasMore) & increment pageCount.

  } catch (error) {
      // 3. LOG ERROR (Catch Block)
      //    Pass response.data if we got it, otherwise null.
      await to_db('ERROR', userId, 'TRANSACTIONS SYNC', { 
         successful_update: false, 
         error_message: error.message 
      }, response?.data || null);
  }
}
```

### Logger Utility

A unified wrapper around Pino (console/stdout) and Prisma (database persistence).

#### Function Signatures

```TypeScript
class 
 {
   // Standard ephemeral logging. 
   // Outputs to stdout via Pino.
   // Output is filtered by `LOG_LEVEL` and formatted by `PRETTY_LOGS`.
  log(level: string, message: string, ...args: any[]): void;

   // Permanent audit logging. 
   // Writes directly to the `system_logs` database table via Prisma.
  async to_db(
    level: string,
    user_id: string,
    type: string, 
    metadata?: Record<string, any>, 
    raw_payload?: Record<string, any>
  ): Promise<void>;
}
```

### Investment Data Blueprint

Plaid Investments returns three core object types from `/investments/holdings/get` and `/investments/transactions/get`. Proposed public tables should keep `user_id`, `item_id`, and raw payload/audit fields alongside the Plaid fields below; enable RLS before exposing them through Supabase.

#### `investment_holdings`

Current positions for investment accounts. Returned by `/investments/holdings/get` in `holdings`; related security metadata is returned separately in `securities`.

| Field | Plaid type | Notes |
| --- | --- | --- |
| `account_id` | string | Plaid account ID for the holding. |
| `security_id` | string | Joins to `securities.security_id`; may change after corporate actions. |
| `institution_price` | number | Last institution-reported price for the security. |
| `institution_price_as_of` | nullable date string | Date the institution price was current. |
| `institution_price_datetime` | nullable date-time string | More precise timestamp when available. |
| `institution_value` | number | Institution-reported holding value. |
| `cost_basis` | nullable number | Total amount spent to acquire the currently held quantity. |
| `quantity` | number | Total units held; options are typically contract count multiplied by 100. |
| `iso_currency_code` | nullable string | Official currency code; mutually exclusive with `unofficial_currency_code`. |
| `unofficial_currency_code` | nullable string | Non-ISO currency code, often for crypto or unsupported currencies. |
| `vested_quantity` | nullable number | Vested equity quantity, when reported. |
| `vested_value` | nullable number | Institution-reported vested value, when reported. |

#### `investment_transactions`

Historical investment activity. Returned by `/investments/transactions/get` in `investment_transactions`; results are paginated by `count` and `offset`.

| Field | Plaid type | Notes |
| --- | --- | --- |
| `investment_transaction_id` | string | Plaid-unique investment transaction ID; primary key candidate. |
| `account_id` | string | Plaid account ID the transaction posted against. |
| `security_id` | nullable string | Joins to `securities.security_id`; null for some cash-only activity. |
| `date` | date string | Posting date, typically settlement date. |
| `datetime` | nullable date-time string | Order initiation timestamp when supplied by the institution. |
| `name` | string | Institution description. |
| `quantity` | number | Units involved; positive for buys, negative for sells. |
| `amount` | number | Complete transaction value; positive for cash debits such as buys, negative for cash credits such as sells. |
| `price` | number | Per-unit transaction price. |
| `fees` | nullable number | Combined fees for the transaction. |
| `type` | string | One of `buy`, `sell`, `cancel`, `cash`, `fee`, `transfer`. |
| `subtype` | string | More specific activity such as `dividend`, `deposit`, `sell short`, `tax withheld`, `withdrawal`. |
| `iso_currency_code` | nullable string | Official currency code; mutually exclusive with `unofficial_currency_code`. |
| `unofficial_currency_code` | nullable string | Non-ISO currency code. |

#### `securities`

Reference data for holdings and transactions. Returned by both Investments endpoints in `securities`; security data is not user-account-specific, but Plaid does not guarantee the same security always has the same ID across institutions.

| Field | Plaid type | Notes |
| --- | --- | --- |
| `security_id` | string | Plaid security ID; primary key candidate. |
| `isin` | nullable string | Requires CUSIP Global Services license access. |
| `cusip` | nullable string | Requires CUSIP Global Services license access. |
| `sedol` | deprecated nullable string | UK security identifier. |
| `institution_security_id` | nullable string | Institution-provided identifier. |
| `institution_id` | nullable string | Institution that owns `institution_security_id`. |
| `proxy_security_id` | nullable string | Plaid-modeled proxy for low-volume or private securities. |
| `name` | nullable string | Display name. |
| `ticker_symbol` | nullable string | Public ticker or short identifier. |
| `is_cash_equivalent` | nullable boolean | Whether the security can be treated like cash. |
| `type` | nullable string | Broad type: `cash`, `cryptocurrency`, `derivative`, `equity`, `etf`, `fixed income`, `loan`, `mutual fund`, `other`. |
| `subtype` | nullable string | More specific type, such as `common stock`, `option`, `bill`, `bond`, `etf`, `mutual fund`. |
| `close_price` | nullable number | Previous close price; null for non-public securities. |
| `close_price_as_of` | nullable date string | Date for `close_price`. |
| `update_datetime` | nullable date-time string | Last security price update time when available. |
| `iso_currency_code` | nullable string | Official currency code for the price. |
| `unofficial_currency_code` | nullable string | Non-ISO currency code. |
| `market_identifier_code` | nullable string | ISO-10383 market/exchange code. |
| `sector` | nullable string | Sector classification. |
| `industry` | nullable string | Industry classification. |
| `sector_code` | nullable string | ISO-10962 CFI code when provided. |
| `option_contract` | nullable object | Option details: type, expiration, strike price, underlying ticker. |
| `fixed_income` | nullable object | Fixed-income details such as yield rate/type, maturity date, and face value. |

### `/investments` Interface Gameplan

- Backend: add an `investments` product to Link for eligible Items, then create routes for `POST /api/investments/holdings/sync`, `POST /api/investments/transactions/sync`, and read endpoints for holdings, transactions, and securities joined to accounts/items.
- Sync: fetch holdings as a full current snapshot, upsert securities first, then upsert holdings by `(account_id, security_id)` while preserving raw payloads. Fetch transactions by date range with Plaid pagination and upsert by `investment_transaction_id`.
- Data model: make holdings user-scoped through account/item ownership, keep securities globally keyed by `security_id`, and add RLS policies on user-owned investment rows in `public`.
- UI: create `/investments` as a focused page with tabs for Holdings, Activity, and Securities. Start with totals by account/institution, holding table with ticker/name/value/quantity/gain basis fields, and activity filters by account, security, type, subtype, and date.
- Operations: add explicit refresh buttons for holdings and transactions. Treat `/investments/refresh` as optional/on-demand because Plaid notes it may trigger per-request billing and webhooks rather than immediately returning new data.

### Server endpoints

| Method | Path                                                                 | Request Data                        | Response                                                       |
| ------ | -------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| POST   | [api/link/token](server/routes/link.ts#L8)                           | query: — body: `{ daysRequested? }` | `{ link_token, ... }`                                          |
| POST   | [api/link/exchange](server/routes/link.ts#L33)                        | query: — body: `{ publicToken }`    | `{ success: true }`                                            |
| GET    | [api/items](server/routes/items.ts#L9)                               | query: — body: —                    | `Item[]` (`id`, `institution_name` only; no Plaid access token) |
| GET    | [api/:itemId/accounts](server/routes/accounts.ts#L6)                   | query: — body: —                    | `Account[]`                                                    |
| POST   | [api/:itemId/accounts/refresh](server/routes/accounts.ts#L12)          | query: — body: —                    | `{ success: true, item_id, updated_accounts }` (calls Plaid `accounts/get`; updates only `name`, `official_name`, `balances`; returns `409` if DB/Plaid account counts mismatch) |
| POST   | [api/items/:itemId/delete_all](server/routes/items.ts#L16)               | query: — body: —                    | `200` / `207`: `{ success: true, deleted: { item, accounts }, plaid_removed, plaid_error? }` (deletes item, its accounts, transactions; then Plaid `item/remove`; `207` if Plaid unlink fails) |
| GET    | [api/transactions](server/routes/transactions.ts#L282)                 | query: `includeRemoved?` body: —    | transaction array                                              |
| POST   | [api/transactions/sync](server/routes/transactions.ts#L270)            | query: — body: —                    | `{ success: true, items_processed, added, modified, removed }`  |
| GET    | [api/investments](server/routes/investments.ts)                        | query: — body: —                    | `{ holdings, transactions, securities }` with joined account/item/security basics |
| POST   | [api/investments/holdings/sync](server/routes/investments.ts)          | query: — body: —                    | `{ success: true, holdings, securities }` from Plaid `/investments/holdings/get` |
| POST   | [api/investments/transactions/sync](server/routes/investments.ts)      | query: — body: `{ startDate?, endDate? }` | `{ success: true, transactions, securities }` from Plaid `/investments/transactions/get` |
| GET    | [api/transaction_meta](server/routes/transaction_meta.ts#L19)         | query: — body: —                    | `{ transaction_id, account_transfer_group, bucket_1_tag_id, bucket_2_tag_id, meta_tag_ids }[]` |
| POST   | [api/transaction_meta/transfer_group](server/routes/transaction_meta.ts#L51) | query: — body: `{ transaction_ids: [id1, id2] }` | `{ account_transfer_group: uuid }` |
| DELETE | [api/transaction_meta/transfer_group](server/routes/transaction_meta.ts#L82) | query: — body: `{ transaction_ids: [id1, id2] }` or `{ transaction_ids: [id] }` (clears whole group for that transfer) | `{ success: true }` |
| POST   | [api/transaction_meta/netting_group](server/routes/transaction_meta.ts#L156) | query: — body: `{ transaction_ids: [id1, id2, ...] }` (2+ ids; rejects ids already in a netting or transfer group) | `{ netting_group: uuid }` |
| PATCH  | [api/transaction_meta/netting_group](server/routes/transaction_meta.ts#L182) | query: — body: `{ netting_group, add_ids?, remove_ids?, dissolve? }` (`dissolve: true` clears the whole group; removing all members also dissolves; leaving exactly 1 is rejected) | `{ success: true, netting_group, member_count }` |
| POST   | [api/transaction_meta/tags](server/routes/transaction_meta.ts#L115)    | query: — body: `TransactionTagChange[]` (set bucket tags and add meta tags) | `{ success: true }` |
| DELETE | [api/transaction_meta/tags](server/routes/transaction_meta.ts#L268)    | query: — body: `TransactionTagChange[]` (remove specified bucket/meta tags only) | `{ success: true }` |
| GET    | [api/tags](server/routes/tags.ts#L34)                                 | query: — body: —                    | tag array                                                      |
| POST   | [api/tags](server/routes/tags.ts#L47)                                 | query: — body: `{ name, type, color? }`     | created tag object                                             |
| PATCH  | [api/tags/:id](server/routes/tags.ts#L64)                              | query: — body: `{ name?, color? }`  | updated tag object                                             |
| DELETE | [api/tags/:id](server/routes/tags.ts#L93)                              | query: — body: —                    | `{ success: true }`                                            |
| GET    | [api/budget_rules](server/routes/budget_rules.ts#L227)                 | query: — body: —                    | budget rule array                                              |
| POST   | [api/budget_rules](server/routes/budget_rules.ts#L240)                 | query: — body: `{ tag_id, name, start_date, type, flat_amount?, percent?, calendar_window, rollover_options }` | created budget rule object |
| PATCH  | [api/budget_rules/:id](server/routes/budget_rules.ts#L301)              | query: — body: partial budget rule object | updated budget rule object                    |
| DELETE | [api/budget_rules/:id](server/routes/budget_rules.ts#L379)             | query: — body: —                    | `{ success: true }`                                            |

### Budget Calculation

```math
\text{effective\_budget}_i = \text{base\_budget}_i + \text{balance}_{i-1}
\qquad
\text{balance}_i =
\mathop{\text{clamp}}\!\left(
\text{effective\_budget}_i - \text{spend}_i,
L, U
\right)
```

**If budget rule is percent of income type:**

```math
\text{base\_budget}_i =
\text{percent} \cdot \text{income}_{i-1}
```

**If budget rule is flat amount type:**

```math
\text{base\_budget}_i = \text{flat\_amount}
```

# Random

## Plaid transactions fetchers

- [https://github.com/plaid/pattern](https://github.com/plaid/pattern)
- [https://github.com/mbafford/plaid-sync](https://github.com/mbafford/plaid-sync)
- [https://github.com/dvankley/firefly-plaid-connector-2](https://github.com/dvankley/firefly-plaid-connector-2)
- [https://github.com/allancalix/clerk](https://github.com/allancalix/clerk)

Full apps:

- [https://github.com/maybe-finance/maybe](https://github.com/maybe-finance/maybe)
- [https://github.com/actualbudget/actual](https://github.com/actualbudget/actual)

There's this too:

- [https://github.com/moyano83/Designing-Data-Intensive-Applications](https://github.com/moyano83/Designing-Data-Intensive-Applications)

