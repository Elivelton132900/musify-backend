import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"
import { RecentYears, RediscoverLovedTracksQuery, SearchFor, SearchForValues } from "../models/last-fm.model"


export class LastFmController {


    static async getTopTracksByDate(req: Request, res: Response) {

        const lastFmService = new LastFmService()


        const userLastFm = req.session.lastFmSession?.user as string
        const percentageSearchFor = req.params.percentage
        const limit = req.params.limit


        const percentageSearchForNumber = SearchFor[percentageSearchFor as keyof typeof SearchFor]



        const resultOldSearchFor = await lastFmService.getTopOldTracksPercentage(userLastFm, Number(percentageSearchForNumber), Number(limit))
        const recentYears = await lastFmService.getTopRecentTrack(userLastFm, RecentYears, Number(limit))


        const resJsonPercentage = percentageSearchForNumber + "% - " + percentageSearchFor

        res.status(200).json({
            old_tracks: resultOldSearchFor,
            recent_tracks: recentYears,
            percentage_user: resJsonPercentage
        })

    }

    static async rediscover(req: Request, res: Response) {

        const lastFmService = new LastFmService()

        const userLastFm = req.session.lastFmSession?.user as string
        const percentageSearchFor = req.params.percentage
        const limit = req.params.limit

        const percentageSearchForNumber = SearchForValues[percentageSearchFor as SearchFor]

        const finalRediscover = await lastFmService.resolveRediscoverList(percentageSearchForNumber, userLastFm, Number(limit))

        res.status(200).json({
            noMoreListenedTrakcs: finalRediscover,
            countMusics: finalRediscover.length,
            musicsRetrieved: Number(limit)
        }
        )
    }

    static async rediscoverLovedTracks(req: Request, res: Response) {

        const lastFmService = new LastFmService()


        const userLastFm = req.session.lastFmSession?.user as string

        const query = req.query as unknown as RediscoverLovedTracksQuery

        const {limit, fetchInDays, distinct, maximumScrobbles} = query

        const percentageSearchFor = req.params.percentage
        const percentageSearchForNumber = SearchForValues[percentageSearchFor as SearchFor]


        const response = await lastFmService.rediscoverLovedTracks(
            userLastFm, 
            limit, 
            percentageSearchForNumber,
            Number(fetchInDays), 
            distinct,
            maximumScrobbles
            )

        if (response) {
            res.status(200).json({
                mostListenedMusic: response,
                musicsRetrivied: response.length
            })
        }

    }

    static async getTopTracksAllTime(req: Request, res: Response) {
        const lastFmService = new LastFmService()
        const userLastFm = req.session.lastFmSession?.user as string

        const limitToFetch = "15"

        console.log(JSON.stringify(await lastFmService.getTopTracksAllTime(userLastFm, limitToFetch), null, 10))
    }

}