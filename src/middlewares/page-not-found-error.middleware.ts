import { NextFunction, Request, Response } from 'express'

interface HttpError extends Error {
    status?: number
}

export const notFound = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const err: HttpError = new Error(`Route ${req.originalUrl} not found`)
    err.status = 404
    next(err)
}