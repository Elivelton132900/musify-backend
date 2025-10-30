import { Request, Response, NextFunction } from "express";

export function isAuthenticatedLastFm(req: Request, res: Response, next: NextFunction) {
    req.lastFmSession = req.session.lastFmSession;
    if (!req.lastFmSession) {
        return res.status(401).json({ error: "Not authenticated" });
    }


    return next();
}