import { LastFmRepository } from './../repositories/last-fm.repository';
import { Request, Response, NextFunction } from "express";
import { unixTimeToUTC, utcToUnixTimestamp } from '../utils/lastFmUtils';
import dayjs from 'dayjs';

export async function resolveDateDefaults(req: Request, res: Response, next: NextFunction) {

    try {
        const userLastFm = req.session.lastFmSession?.user as string


        if (!userLastFm) {
            return next(new Error("Last.FM user not found in session"))
        }

        if (!req.query.to || Number.isNaN(req.query.to)) {
            return next(new Error("Paramaterer 'to' must be informed"))
        }

        const userAccountCreationUnixDate = await new LastFmRepository().getCreationUnixtime(userLastFm)

        const fromDate = req.query.from !== undefined
            ? unixTimeToUTC(Number(req.query.from))
            : unixTimeToUTC(Number(userAccountCreationUnixDate))

        const toDate = req.query.to !== undefined
            ? unixTimeToUTC(Number(req.query.to))
            : unixTimeToUTC(dayjs().subtract(30, "days").unix())

        const userAccountCreationUTCDate = unixTimeToUTC(Number(userAccountCreationUnixDate))

        if (utcToUnixTimestamp(toDate) < utcToUnixTimestamp(fromDate)) {
            return next(new Error("'To' parameter cant not be minor than 'from' parameter "))
        }

        if (utcToUnixTimestamp(fromDate) < utcToUnixTimestamp(userAccountCreationUTCDate)) {
            return next(new Error("'From' can not be minot than your creation account date"))
        }

        if (utcToUnixTimestamp(toDate) < utcToUnixTimestamp(userAccountCreationUTCDate)) {
            return next(new Error("'to' can not be minor than your creation account date"))
        }

        const earliestAllowedFromDate = toDate.subtract(365, "days")

        if (toDate.isBefore(earliestAllowedFromDate)) {
            return next(new Error("maximum fetch range is 365 days"))
        }

        next()
    } catch (error) {
        next(error)
    }
}