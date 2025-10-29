import { Request, Response } from "express"
import { getLoginUrl } from "../utils/lastFmUtils"
import { LastFmService } from "../services/last-fm.auth"

export class LastFmController {

    static async auth(req: Request, res: Response) {
        const API_KEY = process.env.LAST_FM_API_KEY!
        const authURL = getLoginUrl(API_KEY)
        res.redirect(authURL)
    }

    static async callback(req: Request, res: Response) {

        const lastFmService = new LastFmService()

        const token = req.query.token as string

        if (!token) {
            res.status(400).json({ error: "Code not provided" })
            res.end()
        }


        console.log("token: ", token)
        const API_KEY = process.env.LAST_FM_API_KEY!
        const API_SECRET = process.env.LAST_FM_SHARED_SECRET!
        lastFmService.getSession(token, API_KEY, API_SECRET)
        res.redirect("https://uncriticisably-rushier-rashida.ngrok-free.dev")
        res.end()
    }


}