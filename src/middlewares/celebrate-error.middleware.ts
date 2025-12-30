import { isCelebrateError } from "celebrate";
import { Request, Response, NextFunction } from "express"

export const celebrateError = (err: unknown, req: Request, res: Response, next: NextFunction) => {

  if (isCelebrateError(err)) {
    const body = err.details.get("body") || err.details.get("query") || err.details.get("params");
    return res.status(400).json({
      error: "Validation error",
      details: body?.message || body || "Invalid request",
    });
  }

  return next(err)
}