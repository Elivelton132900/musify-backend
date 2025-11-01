import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"
import {  SearchFor } from "../models/last-fm.model"


export class LastFmController {


    static async getTopTracksByDate(req: Request, res: Response) {

        const userLastFm = req.session.lastFmSession?.user as string
        const percentageSearchFor = req.params.percentage


        const percentageSearchForNumber = SearchFor[percentageSearchFor as keyof typeof SearchFor]

        const lastFmService = new LastFmService()
        
        console.log("\n\n", percentageSearchForNumber, "\n\n")

        const resultOldSearchFor = await lastFmService.getTopOldTracksPercentage(userLastFm, Number(percentageSearchForNumber))
        const recentYears = await lastFmService.getTopRecentTrack(userLastFm, SearchFor.recent_years)

        
        const resJsonPercentage = percentageSearchForNumber + "% - " + percentageSearchFor

        res.status(200).json({
            old_tracks: resultOldSearchFor,
            recent_tracks: recentYears,
            percentage_user: resJsonPercentage
        })
        
    }

}