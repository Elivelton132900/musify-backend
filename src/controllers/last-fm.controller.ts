import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"
import { LastFmTopTracks } from "../models/last-fm.model"


export class LastFmController {

    static async getTopTracksAllTime(req: Request, res: Response) {

        const user = req.session.lastFmSession?.user
        
        const lastFmService = new LastFmService()

        const { limit } = req.params

        const apiResponse = await lastFmService.getTopTracks(Number(limit), String(user))
        const topTracks = new LastFmTopTracks(apiResponse)
        const syncTopMusics = lastFmService.syncTopMusicLastFm(topTracks)
        console.log(syncTopMusics)
        res.end()
    }

    static async getTopTracksByDate(req: Request, res: Response) {

        const userLastFm = req.session.lastFmSession?.user as string

        const lastFmService = new LastFmService()

        await lastFmService.getTopTracksByDate(userLastFm)
        res.end()
    }

}