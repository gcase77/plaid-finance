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

### Server endpoints

| Method | Path                                                                 | Request Data                        | Response                                                       |
| ------ | -------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| POST   | [api/link/token](server/routes/link.ts#L8)                           | query: — body: `{ daysRequested? }` | `{ link_token, ... }`                                          |
| POST   | [api/link/exchange](server/routes/link.ts#L33)                        | query: — body: `{ publicToken }`    | `{ success: true }`                                            |
| GET    | [api/items](server/routes/items.ts#L6)                               | query: — body: —                    | `Item[]`                                                       |
| GET    | [api/accounts/:itemId](server/routes/accounts.ts#L6)                   | query: — body: —                    | `Account[]`                                                    |
| GET    | [api/transactions](server/routes/transactions.ts#L282)                 | query: `includeRemoved?` body: —    | transaction array                                              |
| POST   | [api/transactions/sync](server/routes/transactions.ts#L270)            | query: — body: —                    | `{ success: true, items_processed, added, modified, removed }`  |
| GET    | [api/transaction_meta](server/routes/transaction_meta.ts#L19)         | query: — body: —                    | `{ transaction_id, account_transfer_group, bucket_1_tag_id, bucket_2_tag_id, meta_tag_ids }[]` |
| POST   | [api/transaction_meta/transfer_group](server/routes/transaction_meta.ts#L51) | query: — body: `{ transaction_ids: [id1, id2] }` | `{ account_transfer_group: uuid }` |
| DELETE | [api/transaction_meta/transfer_group](server/routes/transaction_meta.ts#L82) | query: — body: `{ transaction_ids: [id1, id2] }` | `{ success: true }` |
| PATCH  | [api/transaction_meta/tags](server/routes/transaction_meta.ts#L107)    | query: — body: `MetaTagUpdate[]`    | `{ success: true }`                                            |
| GET    | [api/tags](server/routes/tags.ts#L10)                                 | query: — body: —                    | tag array                                                      |
| POST   | [api/tags](server/routes/tags.ts#L23)                                 | query: — body: `{ name, type, color? }`     | created tag object                                             |
| DELETE | [api/tags/:id](server/routes/tags.ts#L37)                              | query: — body: —                    | `{ success: true }`                                            |
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

