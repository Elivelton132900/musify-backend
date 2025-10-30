import { TimeRange } from './../types';
import { Request, Response } from "express"
import { SpotifyService } from "../services/spotify.service"

export class SpotifyController {


    static async syncAndCompareLongShort(req: Request, res: Response) {
        const access_token = req.user?.access_token || ""
        const spotifyId = req.user?.spotifyId || ""

        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.long, secondCompare: TimeRange.short }
        
        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)
        res.status(200).json({
            message: "Top musics synced and compared successfully",
            data: noMoreListenedMusics
        })
    }

    static async syncAndCompareMediumShort(req: Request, res: Response) {
        const access_token = req.user?.access_token || ""
        const spotifyId = req.user?.spotifyId || ""

        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.medium, secondCompare: TimeRange.short }

        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)
        res.status(200).json({
            message: "Top musics synced and compared successfully",
            data: noMoreListenedMusics
        })
    }

    static async syncAndCompareLongMedium(req: Request, res: Response) {
        const access_token = req.user?.access_token || ""
        const spotifyId = req.user?.spotifyId || ""

        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.long, secondCompare: TimeRange.medium }

        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)

        res.status(200).json({
            message: "Top musics synced and compare successfully",
            data: noMoreListenedMusics
        })
    }

}


