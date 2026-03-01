import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import itemsRouter from "./routes/items";
import accountsRouter from "./routes/accounts";
import linkRouter from "./routes/link";
import transactionsRouter from "./routes/transactions";
import transactionMetaRouter from "./routes/transaction_meta";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(express.json());

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

if (fs.existsSync(distPath)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(8000);
