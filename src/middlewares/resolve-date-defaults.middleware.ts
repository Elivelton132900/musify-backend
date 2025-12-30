import { LastFmRepository } from './../repositories/last-fm.repository';
import { Request, Response, NextFunction } from "express";
import { unixTimeToUTC } from '../utils/lastFmUtils';
import dayjs from 'dayjs';

export async function resolveDateDefaults(req: Request, res: Response, next: NextFunction) {

    try {
        const userLastFm = req.session.lastFmSession?.user as string


        if (!userLastFm) {
            return next(new Error("Last.FM user not found in session"))
        }

        const userAccountCreationUnixDate = await new LastFmRepository().getCreationUnixtime(userLastFm)

        const fromDate = req.query.from !== undefined
            ? dayjs(req.query.from as string).utc()
            : dayjs().utc()

        const toDate = req.query.to !== undefined
            ? dayjs(req.query.to as string).utc()
            : dayjs().subtract(30, "days").utc()

        const searchPeriodFrom = req.query.searchPeriodFrom !== undefined
            ? dayjs(req.query.searchPeriodFrom as string).utc()
            : undefined

        const searchPeriodTo = req.query.searchPeriodTo !== undefined
            ? dayjs(req.query.searchPeriodTo as string).utc()
            : undefined

        const percentageSearchForExists = req.params.percentage !== undefined ? true : false

        if (percentageSearchForExists) {
            if (searchPeriodFrom || searchPeriodTo) {
                return next(new Error("Since you are passing a predetermined value, you do not need to pass 'searchPeriodFrom' or 'searchPeriodTo'"))
            }
        }

        const userAccountCreationUTCDate = unixTimeToUTC(Number(userAccountCreationUnixDate))

        if (fromDate.isBefore(userAccountCreationUTCDate)) {
            return next(new Error("'From' can not be minor than your creation account date"))
        }

        if (toDate.isBefore(userAccountCreationUTCDate)) {
            return next(new Error("'To' can not be minor than your creation account date"))
        }

        if (fromDate.isAfter(dayjs().utc())) {
            return next(new Error("'From' can not be greater than your creation account date"))
        }

        if (toDate.isBefore(userAccountCreationUTCDate)) {
            return next(new Error("'To' cant not be greater than your creation account date"))
        }

        const earliestAllowedFromDate = fromDate.diff(toDate, "days")
        if (earliestAllowedFromDate > 365) {
            return next(new Error("Maximum fetch range is 365 days"))
        }



        if (searchPeriodTo && searchPeriodFrom) {
            if (searchPeriodTo.isAfter(userAccountCreationUTCDate)) {
                return next(new Error("'From' can not be minor than your creation account date"))
            }

            if (searchPeriodTo.isBefore(userAccountCreationUTCDate)) {
                return next(new Error("'To' can not be minor than your creation account date"))
            }

            if (searchPeriodFrom.isAfter(dayjs().utc())) {
                return next(new Error("'From' can not be greater than your creation account date"))
            }

            if (searchPeriodTo.isAfter(userAccountCreationUTCDate)) {
                return next(new Error("'To' cant not be greater than your creation account date"))
            }

            const earliestAllowedFromDate = searchPeriodFrom.diff(searchPeriodTo, "days") 

            if (earliestAllowedFromDate > 365) {
                return next(new Error("Maximum fetch range is 365 days"))
            }

        }


        if ((searchPeriodFrom && !searchPeriodTo) || (searchPeriodTo && !searchPeriodFrom)) {
            return next(new Error("'searchPeriodTo' parameter or 'searchPeriodFrom' parameter is missing. Since you passed one of these, the other one must be passed as well."))
        }


        next()
    } catch (error: unknown) {

        if (error instanceof Error) {
            return next(error)
        }

        return next(new Error("Unexpected error"))
    }
}