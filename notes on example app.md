# Plaid Transactions App Architecture

## Overview
Node/Express backend + vanilla JS frontend using Plaid Transactions Sync API. SQLite DB stores users, items (bank connections), accounts, transactions.

## Backend Structure

### Core Files
- **server.js**: Express app (port 8000), routes, error handler, webhook server init
- **plaid.js**: Plaid client config (env-based: sandbox/production)
- **db.js**: SQLite wrapper, table creation, all DB operations
- **utils.js**: `getLoggedInUserId()` from cookie
- **simpleTransactionObject.js**: Transaction class, converts Plaid format to DB format

### Routes
- **users.js**: Create/sign in/out, get user info (cookie-based auth)
- **tokens.js**: Generate link token, exchange public token → access token, populate bank/account names
- **transactions.js**: Sync transactions (with cursor pagination), list transactions
- **banks.js**: List banks, deactivate bank (revoke access)
- **debug.js**: Test webhook generation (sandbox only)

### Webhook Server
- **webhookServer.js**: Separate Express server (port 8001) for Plaid webhooks
- Handles `SYNC_UPDATES_AVAILABLE` → calls `syncTransactions()`
- Handles ITEM webhooks (ERROR, NEW_ACCOUNTS_AVAILABLE, etc.)

## Frontend Structure

### Core Files
- **index.html**: Bootstrap UI, sign in/out, bank connection, transaction table
- **client.js**: Main app logic, transaction display, bank list refresh
- **link.js**: Plaid Link integration (token fetch, exchange)
- **signin.js**: User creation/sign in/out, status refresh
- **utils.js**: Server calls, currency formatting, category formatting

## Database Schema

### Tables
- **users**: `id` (TEXT PK), `username` (TEXT)
- **items**: `id` (TEXT PK), `user_id` (FK), `access_token` (TEXT), `transaction_cursor` (TEXT), `bank_name` (TEXT), `is_active` (INT)
- **accounts**: `id` (TEXT PK), `item_id` (FK), `name` (TEXT)
- **transactions**: `id` (TEXT PK), `user_id` (FK), `account_id` (FK), `category`, `date`, `authorized_date`, `name`, `amount` (REAL), `currency_code`, `is_removed` (INT)

## Key Flows

### 1. User Sign In
- POST `/server/users/create` → creates user, sets cookie
- POST `/server/users/sign_in` → sets cookie
- GET `/server/users/get_my_info` → returns user from cookie

### 2. Bank Connection
- POST `/server/tokens/generate_link_token` → returns link_token
- Frontend: Plaid Link opens with token
- On success: POST `/server/tokens/exchange_public_token` → stores item, fetches bank/account names, initial sync

### 3. Transaction Sync
- `syncTransactions(itemId)`:
  1. Get access_token + cursor from DB
  2. Call `transactionsSync()` with cursor (paginated)
  3. Process added/modified/removed transactions
  4. Save new cursor
- Triggered by: manual `/server/transactions/sync` or webhook

### 4. Transaction Display
- GET `/server/transactions/list?maxCount=50` → JOIN transactions/accounts/items, filter removed, order by date DESC

## Plaid API Usage

### Endpoints Used
- `linkTokenCreate()`: Generate Link token
- `itemPublicTokenExchange()`: Exchange public token
- `itemGet()`: Get institution_id
- `institutionsGetById()`: Get bank name
- `accountsGet()`: Get account names
- `transactionsSync()`: Sync transactions (cursor-based pagination)
- `itemRemove()`: Revoke access

### Cursor Management
- Stored per item in `items.transaction_cursor`
- Used for incremental sync (only fetch new/changed)
- Must save after each sync

### Webhooks
- `SYNC_UPDATES_AVAILABLE`: New transactions available
- `ITEM.ERROR`: Credentials issue
- `ITEM.NEW_ACCOUNTS_AVAILABLE`: New accounts at FI
- `ITEM.PENDING_EXPIRATION`: Reconnection needed
- `ITEM.USER_PERMISSION_REVOKED`: User revoked access

## Security Notes
- Cookie-based auth (httpOnly cookies)
- HTML escaping on user inputs
- Access token stored in DB (encrypt in production)
- Item ownership verification before operations

## Environment Variables
- `PLAID_CLIENT_ID`: Plaid client ID
- `PLAID_SECRET`: Plaid secret (env-specific)
- `PLAID_ENV`: sandbox/production/development
- `APP_PORT`: Main server port (default 8000)
- `WEBHOOK_PORT`: Webhook server port (default 8001)
- `WEBHOOK_URL`: Public webhook URL (for ngrok)

## Dependencies
- express, body-parser, cookie-parser
- plaid (v30.0.0)
- sqlite, sqlite3
- dotenv, uuid, escape-html
- nodemon (dev)
