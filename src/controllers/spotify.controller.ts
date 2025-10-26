import { Request, Response } from "express"
import { SpotifyService } from "../services/spotify.service"

export class SpotifyController {

    static async getTopMusics(req: Request, res: Response) {

        const access_token = req.user?.access_token || ""
        const spotifyId = req.user?.spotifyId || ""

        if (!access_token || !spotifyId) {
            res.status(400).json({ message: "Missing Spotify credentials." })
            return
        }

        const spotifyService = new SpotifyService()

         await spotifyService.syncAllTopMusics(access_token, spotifyId)

         res.status(201).json({
            message: "top musics synced"
         })
    }
}
