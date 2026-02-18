import express from "express";
import { TagType, type PrismaClient } from "../../generated/prisma/client";

type Params = { prisma: PrismaClient };

const VALID_TYPES = new Set<string>(Object.values(TagType));

export default ({ prisma }: Params) => {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const tags = await prisma.tags.findMany({ where: { user_id: userId }, orderBy: { name: "asc" } });
      res.json(tags);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const name = String(req.body?.name || "").trim();
      const type = String(req.body?.type || "").trim();
      if (!name) return res.status(400).json({ error: "name is required" });
      if (!VALID_TYPES.has(type)) return res.status(400).json({ error: "invalid type" });
      const tag = await prisma.tags.create({ data: { name, type: type as TagType, user_id: userId } });
      res.status(201).json(tag);
    } catch (e: any) {
      if (e.code === "P2002") return res.status(409).json({ error: "A tag with that name already exists" });
      res.status(500).json({ error: e.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = Number(req.params.id);
      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "name is required" });
      const existing = await prisma.tags.findFirst({ where: { id, user_id: userId } });
      if (!existing) return res.status(404).json({ error: "Tag not found" });
      const tag = await prisma.tags.update({ where: { id }, data: { name } });
      res.json(tag);
    } catch (e: any) {
      if (e.code === "P2002") return res.status(409).json({ error: "A tag with that name already exists" });
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const id = Number(req.params.id);
      const existing = await prisma.tags.findFirst({ where: { id, user_id: userId } });
      if (!existing) return res.status(404).json({ error: "Tag not found" });
      const usageCount = await prisma.transaction_meta.count({
        where: { OR: [{ bucket_1_tag_id: id }, { bucket_2_tag_id: id }, { meta_tag_id: id }] }
      });
      if (usageCount > 0) return res.status(409).json({ error: `Tag is used by ${usageCount} transaction(s). Remove it from transactions first.`, usageCount });
      await prisma.tags.delete({ where: { id } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
