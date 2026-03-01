import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { createUserScopedClient, type UserScopedPrisma } from "../lib/prisma";

export type ServerRequest = Request & {
  user: { id: string; email: string | null };
  prisma: UserScopedPrisma;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.get("authorization")?.startsWith("Bearer ")
    ? req.get("authorization")!.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

  const serverReq = req as unknown as ServerRequest;
  serverReq.user = { id: data.user.id, email: data.user.email ?? null };
  serverReq.prisma = createUserScopedClient(data.user.id);
  return next();
};
