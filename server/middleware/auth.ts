import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { runtimeAuthMode } from "../config/auth";

const supabase = runtimeAuthMode === "supabase"
  ? createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
  : null;

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (runtimeAuthMode === "dev") {
    const authHeader = req.headers.authorization;
    const headerUserId = typeof req.headers["x-dev-user-id"] === "string" ? req.headers["x-dev-user-id"] : "";
    const bearerUserId = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
    const userId = String(headerUserId || bearerUserId || "").trim();

    if (!userId) {
      return res.status(401).json({ error: "Missing development user id" });
    }

    (req as any).user = { id: userId, email: `${userId}@dev.local` };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  const { data: { user }, error } = await supabase!.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  (req as any).user = { id: user.id, email: user.email };
  next();
};
