import express from "express";
import { TagType } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";
import { clearTransactionMetaCache } from "../lib/caches";

const router = express.Router();

const VALID_TYPES = new Set<string>(Object.values(TagType));
const TAG_COLOR_PALETTE = [
  "#e63946",
  "#ff6b35",
  "#ffbe0b",
  "#2a9d8f",
  "#00a6fb",
  "#4361ee",
  "#7209b7",
  "#b5179e",
  "#f15bb5",
  "#8ac926",
  "#198754",
  "#6c757d"
] as const;
const DEFAULT_COLORS: Record<TagType, string> = {
  income_bucket_1: "#198754",
  income_bucket_2: "#2a9d8f",
  spending_bucket_1: "#e63946",
  spending_bucket_2: "#ff6b35",
  meta: "#6c757d"
};

const getDefaultTagColor = (type: TagType): string => DEFAULT_COLORS[type];
const isAllowedTagColor = (color: string): boolean => TAG_COLOR_PALETTE.includes(color as (typeof TAG_COLOR_PALETTE)[number]);

router.get("/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const tags = await prisma.tags.findMany({
      where: { user_id: user.id },
      orderBy: { name: "asc" }
    });
    res.json(tags);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const { name, type, color } = req.body;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    if (!VALID_TYPES.has(type)) return res.status(400).json({ error: "Invalid tag type" });
    if (color != null && !isAllowedTagColor(color)) return res.status(400).json({ error: "Invalid tag color" });
    const tag = await prisma.tags.create({
      data: { name, type, color: color ?? getDefaultTagColor(type as TagType), user_id: user.id }
    });
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
