import { Request, Response } from "express"
import { AuthService } from "../services/auth.service"
import { exchangeCodeForToken, getLoginUrl, getSpotifyUserProfile } from "../utils/spotifyUtils"
import { SpotifyFullProfile } from "../models/auth.model"
export class AuthController {

    static async login(req: Request, res: Response) {
        const authUrl = getLoginUrl()
        res.redirect(authUrl)
    }

    static async callback(req: Request, res: Response): Promise<void> {
        const code = req.query.code as string


        if (!code) {
            res.status(400).json({ error: "Code not provided" })
            res.end()
        }

        const tokens = await exchangeCodeForToken(code)
        const user = await getSpotifyUserProfile(tokens.access_token)

        // const spotifyUserProfileInfo = await new AuthService().getById(user.id)
        const fullProfile: SpotifyFullProfile = { ...tokens, ...user }

        res.send(await new AuthService().saveFullProfileInfo(fullProfile))
    }
}

    // static async refreshSpotifyToken(req: Request, res: Response) {
    //     const refreshToken = ""
    //     const data = await refreshSpotifyToken(refreshToken)
    //     console.log("data", data)
    // }

    
//TO DO: Implementar se um usuário já existir no DB, não registrar dnv
//TO DO: Implementar solicitar um novo token ou refresh token apenas quando o access token te expirado