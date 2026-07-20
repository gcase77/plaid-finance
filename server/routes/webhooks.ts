import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

const outFile = path.join(__dirname, "..", "..", "stripe-webhook-events.md");

export function stripeWebhook(req: Request, res: Response) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* keep raw */
  }
  fs.appendFileSync(outFile, `\n## ${new Date().toISOString()}\n\n\`\`\`json\n${pretty}\n\`\`\`\n`);
  res.json({ received: true });
}
