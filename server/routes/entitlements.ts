import express from "express";
import { getEntitlements } from "../lib/entitlements";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.get("/entitlements", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const entitlements = await getEntitlements(prisma, user.id);
    res.json(entitlements);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
