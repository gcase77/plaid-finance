import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const PORT = Number(process.env.PORT || 8010);
const USER_ID = "demo-user";
const LINK_TOKEN_KEY = "plaid_link_token";

const dbPath = path.join(__dirname, "investments.sqlite");
const db = new sqlite3.Database(dbPath);
const run = (sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function onRun(err) { (err ? reject(err) : resolve(this)); }));
const get = (sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const all = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
        "Plaid-Version": "2020-09-14"
      }
    }
  })
);

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS items (
    item_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    name TEXT,
    official_name TEXT,
    type TEXT,
    subtype TEXT,
    mask TEXT,
    raw_json TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    security_id TEXT NOT NULL,
    institution_value REAL,
    quantity REAL,
    cost_basis REAL,
    institution_price REAL,
    institution_price_as_of TEXT,
    raw_json TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS securities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    security_id TEXT NOT NULL,
    name TEXT,
    ticker_symbol TEXT,
    type TEXT,
    subtype TEXT,
    raw_json TEXT NOT NULL
  )`);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/link/token", async (_req, res) => {
  try {
    const linkTokenRequest = {
      user: { client_user_id: USER_ID },
      products: ["investments"],
      client_name: "Investments Model",
      language: "en",
      country_codes: ["US"]
    };
    if (process.env.PLAID_REDIRECT_URI) linkTokenRequest.redirect_uri = process.env.PLAID_REDIRECT_URI;
    const { data } = await plaid.linkTokenCreate(linkTokenRequest);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error?.response?.data?.error_message || error.message });
  }
});

app.post("/api/link/exchange", async (req, res) => {
  try {
    const publicToken = req.body?.publicToken;
    if (!publicToken) return res.status(400).json({ error: "publicToken required" });

    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const itemData = (await plaid.itemGet({ access_token: exchange.data.access_token })).data.item;
    const accounts = (await plaid.accountsGet({ access_token: exchange.data.access_token })).data.accounts;

    await run(
      `INSERT INTO items (item_id, user_id, access_token, institution_id, institution_name)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         access_token=excluded.access_token,
         institution_id=excluded.institution_id,
         institution_name=excluded.institution_name`,
      [exchange.data.item_id, USER_ID, exchange.data.access_token, itemData.institution_id, itemData.institution_name]
    );

    for (const account of accounts) {
      await run(
        `INSERT INTO accounts (account_id, item_id, name, official_name, type, subtype, mask, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           item_id=excluded.item_id,
           name=excluded.name,
           official_name=excluded.official_name,
           type=excluded.type,
           subtype=excluded.subtype,
           mask=excluded.mask,
           raw_json=excluded.raw_json`,
        [
          account.account_id,
          exchange.data.item_id,
          account.name || null,
          account.official_name || null,
          account.type || null,
          account.subtype || null,
          account.mask || null,
          JSON.stringify(account)
        ]
      );
    }

    res.json({ success: true, item_id: exchange.data.item_id });
  } catch (error) {
    res.status(500).json({ error: error?.response?.data?.error_message || error.message });
  }
});

app.get("/api/items", async (_req, res) => {
  const rows = await all(`SELECT item_id, institution_name, created_at FROM items WHERE user_id = ? ORDER BY created_at DESC`, [USER_ID]);
  res.json(rows);
});

app.post("/api/items/:itemId/remove", async (req, res) => {
  try {
    const itemId = String(req.params.itemId || "");
    if (!itemId) return res.status(400).json({ error: "itemId required" });

    const item = await get(`SELECT access_token FROM items WHERE item_id = ?`, [itemId]);
    if (!item?.access_token) return res.status(404).json({ error: "Item not found" });

    let plaidRemoved = false;
    let plaidError = null;
    try {
      await plaid.itemRemove({ access_token: item.access_token });
      plaidRemoved = true;
    } catch (error) {
      plaidError = error?.response?.data?.error_message || error?.message || "Plaid item/remove failed";
    }

    await run(`DELETE FROM holdings WHERE item_id = ?`, [itemId]);
    await run(`DELETE FROM securities WHERE item_id = ?`, [itemId]);
    await run(`DELETE FROM accounts WHERE item_id = ?`, [itemId]);
    await run(`DELETE FROM items WHERE item_id = ?`, [itemId]);

    res.json({ success: true, item_id: itemId, local_deleted: true, plaid_removed: plaidRemoved, plaid_error: plaidError });
  } catch (error) {
    res.status(500).json({ error: error?.response?.data?.error_message || error.message });
  }
});

app.post("/api/investments/sync", async (req, res) => {
  try {
    const itemId = req.body?.itemId;
    if (!itemId) return res.status(400).json({ error: "itemId required" });

    const item = await get(`SELECT access_token FROM items WHERE item_id = ?`, [itemId]);
    if (!item?.access_token) return res.status(404).json({ error: "Item not found" });

    const response = await plaid.investmentsHoldingsGet({ access_token: item.access_token });
    const { accounts, holdings, securities } = response.data;

    for (const account of accounts || []) {
      await run(
        `INSERT INTO accounts (account_id, item_id, name, official_name, type, subtype, mask, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           item_id=excluded.item_id,
           name=excluded.name,
           official_name=excluded.official_name,
           type=excluded.type,
           subtype=excluded.subtype,
           mask=excluded.mask,
           raw_json=excluded.raw_json`,
        [
          account.account_id,
          itemId,
          account.name || null,
          account.official_name || null,
          account.type || null,
          account.subtype || null,
          account.mask || null,
          JSON.stringify(account)
        ]
      );
    }

    await run(`DELETE FROM holdings WHERE item_id = ?`, [itemId]);
    await run(`DELETE FROM securities WHERE item_id = ?`, [itemId]);

    for (const h of holdings || []) {
      await run(
        `INSERT INTO holdings (item_id, account_id, security_id, institution_value, quantity, cost_basis, institution_price, institution_price_as_of, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          h.account_id,
          h.security_id,
          h.institution_value ?? null,
          h.quantity ?? null,
          h.cost_basis ?? null,
          h.institution_price ?? null,
          h.institution_price_as_of ?? null,
          JSON.stringify(h)
        ]
      );
    }

    for (const s of securities || []) {
      await run(
        `INSERT INTO securities (item_id, security_id, name, ticker_symbol, type, subtype, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, s.security_id, s.name || null, s.ticker_symbol || null, s.type || null, s.subtype || null, JSON.stringify(s)]
      );
    }

    res.json({
      success: true,
      counts: { accounts: accounts?.length || 0, holdings: holdings?.length || 0, securities: securities?.length || 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error?.response?.data?.error_message || error.message });
  }
});

app.get("/api/accounts", async (req, res) => {
  const itemId = String(req.query.itemId || "");
  if (!itemId) return res.status(400).json({ error: "itemId required" });
  const rows = await all(`SELECT raw_json FROM accounts WHERE item_id = ?`, [itemId]);
  res.json(rows.map((r) => JSON.parse(r.raw_json)));
});

app.get("/api/investments", async (req, res) => {
  const itemId = String(req.query.itemId || "");
  if (!itemId) return res.status(400).json({ error: "itemId required" });

  const holdingsRows = await all(`SELECT raw_json FROM holdings WHERE item_id = ?`, [itemId]);
  const securitiesRows = await all(`SELECT raw_json FROM securities WHERE item_id = ?`, [itemId]);
  res.json({
    holdings: holdingsRows.map((r) => JSON.parse(r.raw_json)),
    securities: securitiesRows.map((r) => JSON.parse(r.raw_json))
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Investments model listening on http://localhost:${PORT}`);
    console.log(`SQLite file: ${dbPath}`);
    console.log(`Session key used for Plaid OAuth return: ${LINK_TOKEN_KEY}`);
  });
});
