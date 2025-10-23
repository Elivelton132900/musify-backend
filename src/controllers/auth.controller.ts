import { Request, Response } from "express"
import { AuthService } from "../services/auth.service"

export class AuthController {

    static async login(req: Request, res: Response) {
        const authUrl = AuthService.getLoginUrl()
        res.redirect(authUrl)
    }

    static async callback(req: Request, res: Response): Promise<void> {
        const code = req.query.code as string

        if (!code) {
            res.status(400).json({error: "Code not provided"})
            res.end()
        }

        const tokens = await AuthService.exchangeCodeForToken(code)
        const user = await AuthService.getSpotifyUserProfile(tokens.access_token)

        res.json({ user, tokens })
   }
}