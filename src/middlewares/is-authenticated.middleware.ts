import { Request, Response, NextFunction } from "express";

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    req.user = req.session.user;
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }


    return next();
}