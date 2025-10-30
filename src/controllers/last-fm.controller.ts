import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"


export class LastFmController {

    static async getTopTracks(req: Request, res: Response) {

        const user = req.session.lastFmSession?.user

        const { limit } = req.params
        const topTracks = await new LastFmService().getTopTracks(Number(limit), String(user))
        console.log(JSON.stringify(topTracks, null, 10))
        res.end()
    }

}