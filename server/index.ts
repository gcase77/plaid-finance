import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
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
app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
});

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
