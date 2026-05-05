import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import itemsRouter from "./routes/items";
import accountsRouter from "./routes/accounts";
import linkRouter from "./routes/link";
import transactionsRouter from "./routes/transactions";
import transactionMetaRouter from "./routes/transaction_meta";
import tagsRouter from "./routes/tags";
import budgetRulesRouter from "./routes/budget_rules";
import { requireAuth } from "./middleware/auth";

const app = express();
app.set("trust proxy", true);
app.use(express.json());

app.use((req, res, next) => {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isSecure = req.secure || forwardedProto === "https";
  const isLocalhost = req.hostname === "localhost" || req.hostname === "127.0.0.1";
  const allowInsecure = process.env.ALLOW_INSECURE_HTTP === "true" || process.env.NODE_ENV !== "production";

  if (!isSecure) {
    if (allowInsecure && isLocalhost) return next();
    return res.status(426).json({ error: "HTTPS is required" });
  }

  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return next();
});

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.use("/api", requireAuth);
app.use("/api", itemsRouter);
app.use("/api", accountsRouter);
app.use("/api", linkRouter);
app.use("/api", transactionsRouter);
app.use("/api", transactionMetaRouter);
app.use("/api", tagsRouter);
app.use("/api", budgetRulesRouter);

if (fs.existsSync(distPath)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(8000);
