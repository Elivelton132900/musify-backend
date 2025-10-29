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
        lastFmService.getSession(token, API_KEY)
        res.redirect("https://uncriticisably-rushier-rashida.ngrok-free.dev")

        console.log("token: ", token)
        console.log("token: ", req.session.lastFmSession?.token)
        res.end()
    }


}