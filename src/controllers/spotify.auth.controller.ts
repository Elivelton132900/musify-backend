import { Request, Response } from "express"
import { SpotifyAuthService } from "../services/auth.spotify.service.js"
import { exchangeCodeForToken, getLoginUrl, getSpotifyUserProfile } from "../utils/spotifyUtils.js"
import { SpotifyFullProfile } from "../models/spotify.auth.model.js"

export class AuthSpotifyController {

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

        req.session.user = {
            spotifyId: user.spotifyId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
        }

        const fullProfile: SpotifyFullProfile = { ...tokens, ...user }

        const savedProfile = await new SpotifyAuthService().saveFullProfileInfo(fullProfile)

        res.json({
            message: "Login Successful",
            user: savedProfile,
            session: req.session.user
        })
    }
}

