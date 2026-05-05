import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";
import { createUserScopedClient, type UserScopedPrisma } from "../lib/prisma";

export type ServerRequest = Request & {
  user: { id: string; email: string | null };
  prisma: UserScopedPrisma;
};

/** Supabase user JWT already verified by getUser; payload read for `aal` only. */
const jwtPayloadAal = (token: string): string | undefined => {
  try {
    const p = token.split(".")[1];
    if (!p) return undefined;
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    const json = Buffer.from(pad, "base64").toString("utf8");
    return (JSON.parse(json) as { aal?: string }).aal;
  } catch {
    return undefined;
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.get("authorization")?.startsWith("Bearer ")
    ? req.get("authorization")!.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

  const hasVerifiedMfa = (data.user.factors ?? []).some((f) => f.status === "verified");
  if (hasVerifiedMfa && jwtPayloadAal(token) !== "aal2") {
    return res.status(401).json({ error: "MFA verification required" });
  }

  const serverReq = req as unknown as ServerRequest;
  serverReq.user = { id: data.user.id, email: data.user.email ?? null };
  serverReq.prisma = createUserScopedClient(data.user.id);
  return next();
};
