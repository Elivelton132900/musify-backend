import { Request, Response } from "express"
import { getLoginUrl } from "../utils/lastFmUtils"
import { LastFmService } from "../services/last-fm.auth.service"

export class LastFmController {

    static async auth(req: Request, res: Response) {

        const API_KEY = process.env.LAST_FM_API_KEY!
        const authURL = getLoginUrl(API_KEY)
        res.redirect(authURL)

    }

    static async callback(req: Request, res: Response) {

        req.session.lastFmSession = {
            token: req.query.token as string
        }

        const lastFmService = new LastFmService()

        const token = req.query.token as string

        if (!token) {
            res.status(400).json({ error: "Code not provided" })
            res.end()
        }

        const API_KEY = process.env.LAST_FM_API_KEY!
        console.log(await lastFmService.getSession(token, API_KEY))
        console.log(JSON.stringify(await lastFmService.getUserInfo(API_KEY, "Elivelton1329"), null, 2))
        res.redirect("https://uncriticisably-rushier-rashida.ngrok-free.dev")

        res.end()
    }


}