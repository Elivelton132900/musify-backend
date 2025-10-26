import { Request, Response } from "express"
import { SpotifyService } from "../services/spotify.service"

export class SpotifyController {

    static async getTopMusics(req: Request, res: Response) {

        const access_token = req.user?.access_token || ""

        const topMusics = await new SpotifyService().getTopMusics(access_token)
        
        res.end()
    }
}
