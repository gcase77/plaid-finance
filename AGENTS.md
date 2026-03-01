## Cursor Cloud specific instructions

This is a personal finance app (React + Express + Prisma + Supabase + Plaid). See `README.md` for architecture details.

### Quick reference


| Task                  | Command                                                     |
| --------------------- | ----------------------------------------------------------- |
| Install deps          | `npm install` (also runs `prisma generate` via postinstall) |
| Lint                  | `npm run lint` (ESLint on `src/`)                           |
| Build                 | `npm run build` (Vite production build)                     |
| Dev (both servers)    | `npm run start` (concurrently runs Vite + Express)          |
| Dev (frontend only)   | `npm run dev:client`                                        |
| Dev (backend only)    | `npm run dev:server`                                        |
| Dev (backend + watch) | `npm run watch` (nodemon auto-reload)                       |


### Caveats

- The Express server (`server/index.ts`) requires `DATABASE_URL` at module load time — it will crash immediately without it. The Vite frontend can run independently via `npm run dev:client`.
- Required env vars for full operation: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`. Place them in a root `.env` file.
- Node.js v22+ and npm are used. There is no `.nvmrc` or version manager config — the system Node works fine.

