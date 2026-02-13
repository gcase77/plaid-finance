import "dotenv/config";
import express from "express";
import path from "path";
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
const publicDir = path.join(__dirname, "..", "public");

app.get("/js/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`window.SUPABASE_URL = "${process.env.SUPABASE_URL || ""}";
window.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY || ""}";`);
});
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", requireAuth);
app.use("/api", userRoutes({ prisma }));
app.use("/api", itemRoutes({ prisma }));
app.use("/api", accountRoutes({ prisma }));
app.use("/api", linkRoutes({ plaid, prisma, logger }));
const txRoutes = transactionRoutes({ plaid, prisma, logger });
app.get("/api/transactions", txRoutes.getAllHandler);
app.use("/api/transactions", txRoutes.router);

app.listen(8000);
