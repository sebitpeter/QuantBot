import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId ?? auth?.userId;

  if (!auth || !userId) {
    res.set("Cache-Control", "no-store");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.set("Cache-Control", "no-store");
  next();
}
