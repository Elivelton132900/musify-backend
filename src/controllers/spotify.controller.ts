import { SpotifyCookies, SpotifyJWTPayload } from './../models/spotify.auth.model';
import { Request, Response } from "express"
import { TimeRange } from './../models/spotify.model';
import { SpotifyService } from "../services/spotify.service"

interface SpotifyRequest extends Request {
    cookies: SpotifyCookies,
    spotifyUser?: SpotifyJWTPayload
}

export class SpotifyController {

    static async syncAndCompareLongShort(req: SpotifyRequest, res: Response) {
        const access_token = req.spotifyUser?.access_token || ""
        const spotifyId = req.spotifyUser?.spotifyId || ""
        console.log("\n\n\n\n\nREQ. USER \n\n\n\n\n\n\n", req.spotifyUser)
        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.long, secondCompare: TimeRange.short }
        
        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)
        res.status(200).json({
            message: "Top musics synced and compared successfully",
            data: noMoreListenedMusics
        })
    }

    static async syncAndCompareMediumShort(req: SpotifyRequest, res: Response) {
        const access_token = req.spotifyUser?.access_token || ""
        const spotifyId = req.spotifyUser?.spotifyId || ""

        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.medium, secondCompare: TimeRange.short }

        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)
        res.status(200).json({
            message: "Top musics synced and compared successfully",
            data: noMoreListenedMusics
        })
    }

    static async syncAndCompareLongMedium(req: SpotifyRequest, res: Response) {
        const access_token = req.spotifyUser?.access_token || ""
        const spotifyId = req.spotifyUser?.spotifyId || ""

        const spotifyService = new SpotifyService()

        const compare = { firstCompare: TimeRange.long, secondCompare: TimeRange.medium }

        const noMoreListenedMusics = await spotifyService.syncAndCompare(access_token, spotifyId, compare)

        res.status(200).json({
            message: "Top musics synced and compare successfully",
            data: noMoreListenedMusics
        })
    }

}


