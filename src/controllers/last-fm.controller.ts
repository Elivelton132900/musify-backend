import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"
import { RecentYears, SearchFor } from "../models/last-fm.model"


export class LastFmController {


    static async getTopTracksByDate(req: Request, res: Response) {

        const userLastFm = req.session.lastFmSession?.user as string
        const percentageSearchFor = req.params.percentage
        const limit = req.params.limit


        const percentageSearchForNumber = SearchFor[percentageSearchFor as keyof typeof SearchFor]

        const lastFmService = new LastFmService()


        const resultOldSearchFor = await lastFmService.getTopOldTracksPercentage(userLastFm, Number(percentageSearchForNumber), Number(limit))
        const recentYears = await lastFmService.getTopRecentTrack(userLastFm, RecentYears, Number(limit))


        const resJsonPercentage = percentageSearchForNumber + "% - " + percentageSearchFor

        res.status(200).json({
            old_tracks: resultOldSearchFor,
            recent_tracks: recentYears,
            percentage_user: resJsonPercentage
        })

    }

    static async Rediscover(req: Request, res: Response) {

        const lastFmService = new LastFmService()

        const userLastFm = req.session.lastFmSession?.user as string
        const percentageSearchFor = req.params.percentage
        const limit = req.params.limit

        const finalRediscover = await lastFmService.resolveRediscoverList(percentageSearchFor, userLastFm, Number(limit))

        res.status(200).json({
            noMoreListenedTrakcs: finalRediscover,
            countMusics: finalRediscover.length,
            musicsRetrieved: Number(limit)
        }
        )

    }

    static async getTopTracksAllTime(req: Request, res: Response) {
        const userLastFm = req.session.lastFmSession?.user as string
        const lastFmService = new LastFmService()

        const limitToFetch = "15"

        console.log(JSON.stringify(await lastFmService.getTopTracksAllTime(userLastFm, limitToFetch), null, 10))
    }

}