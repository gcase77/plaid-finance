# Perfect filters lab

**Run this** (from the repository root; `npm install` only needed once):

```bash
cd models/perfect-filters
npm install
npm run dev
```

Then open **http://localhost:5180** (port is set in `vite.config.ts`). No backend or `.env`.

---

Standalone sandbox: its own `package.json` and `node_modules` — nothing here wires into the root app’s `npm run dev` or `tsconfig`.

Contents: copied `TransactionTable` + helpers, `dummy-data.json`, and `theme.css` (copied from `src/theme.css`; re-copy from the app if styles drift).

### Regenerate dummy data

```bash
node models/perfect-filters/generate-dummy-data.mjs
```

(from repo root, or run `node generate-dummy-data.mjs` from inside `models/perfect-filters`)
