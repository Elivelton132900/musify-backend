import { Request, Response } from "express"
import { AuthService } from "../services/auth.service"
export class AuthController {

    static async login(req: Request, res: Response) {
        const authUrl = new AuthService().getLoginUrl()
        res.redirect(authUrl)
    }

    static async callback(req: Request, res: Response): Promise<void> {
        const code = req.query.code as string

        if (!code) {
            res.status(400).json({ error: "Code not provided" })
            res.end()
        }

        const tokens = await new AuthService().exchangeCodeForToken(code)
        const user = await new AuthService().getSpotifyUserProfile(tokens.access_token)

        const fullProfile = {...tokens, ...user}  

        res.send(await new AuthService().saveFullProfileDB(fullProfile))
    }

    static async refreshSpotifyToken(req: Request, res: Response) {
        const refreshToken = ""
        const data = await new AuthService().refreshSpotifyToken(refreshToken)
        console.log("data", data)
    }
}