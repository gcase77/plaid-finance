import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { Configuration, PlaidEnvironments, PlaidApi } from "plaid";
import userRoutes from "./routes/users";
import itemRoutes from "./routes/items";
import accountRoutes from "./routes/accounts";
import linkRoutes from "./routes/link";
import transactionRoutes from "./routes/transactions";
import { prisma } from "./prisma";
import { Logger } from "./logger";
import { requireAuth } from "./middleware/auth";
const app = express();
app.use(express.json());

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

const logger = new Logger(prisma);
const authMode = process.env.AUTH_MODE === "dev" ? "dev" : "supabase";

app.get("/api/config", (_req, res) => {
  res.json({
    authMode,
    supabaseUrl: authMode === "supabase" ? process.env.SUPABASE_URL || "" : "",
    supabaseAnonKey: authMode === "supabase" ? process.env.SUPABASE_ANON_KEY || "" : ""
  });
});

if (authMode === "dev") {
  app.get("/api/dev/users", async (_req, res) => {
    const users = await prisma.users.findMany({ select: { id: true, username: true }, orderBy: { username: "asc" } });
    res.json(users);
  });

  app.post("/api/dev/users", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    if (!username) return res.status(400).json({ error: "username is required" });
    const id = randomUUID();
    const user = await prisma.users.create({ data: { id, username } });
    res.json({ id: user.id, username: user.username });
  });
}

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.use("/api", requireAuth);
app.use("/api", userRoutes({ prisma }));
app.use("/api", itemRoutes({ prisma }));
app.use("/api", accountRoutes({ prisma }));
app.use("/api", linkRoutes({ plaid, prisma, logger }));
const txRoutes = transactionRoutes({ plaid, prisma, logger });
app.get("/api/transactions", txRoutes.getAllHandler);
app.use("/api/transactions", txRoutes.router);

if (fs.existsSync(distPath)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(8000);
