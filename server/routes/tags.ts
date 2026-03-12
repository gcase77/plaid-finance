import express from "express";
import { TagType } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";
import { clearTransactionMetaCache } from "../lib/caches";

const router = express.Router();

const VALID_TYPES = new Set<string>(Object.values(TagType));

router.post("/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    if (!VALID_TYPES.has(type)) return res.status(400).json({ error: "Invalid tag type" });
    const tag = await prisma.tags.create({ data: { name, type, user_id: user.id } });
    res.status(201).json(tag);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Tag name already exists" });
    res.status(500).json({ error: e.message });
  }
});

router.delete("/tags/:id", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid tag id" });
    await prisma.tags.delete({ where: { id } });
    clearTransactionMetaCache(user.id);
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === "P2025") return res.status(404).json({ error: "Tag not found" });
    res.status(500).json({ error: e.message });
  }
});

export default router;
