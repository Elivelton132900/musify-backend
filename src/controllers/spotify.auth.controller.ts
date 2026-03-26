import { Request, Response } from "express"
import { exchangeCodeForToken, getLoginUrl, getSpotifyUserProfile } from "../utils/spotifyUtils.js"
import jwt from "jsonwebtoken"
import dayjs, { isDayjs } from "dayjs"

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
        console.log("USER SPOTIFY: ", user)

        const expires_in = tokens.expires_in instanceof Date ||
            isDayjs(tokens.expires_in)
            ? (tokens.expires_in instanceof Date
                ? Math.floor(tokens.expires_in.getTime() / 1000) // date em segundos
                : tokens.expires_in.unix()) // dayjs em segundos
            : Math.floor(dayjs(tokens.expires_in).unix()) // string ou number em segundos

        // GERAR INTERFACE
        const payload = {
            spotifyId: user.spotifyId,
            userId: user.spotifyId,
            email: user.email,
            display_name: user.display_name,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (expires_in * 1000)
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "1h" })

        res.cookie("spotify_token", token, {
            httpOnly: true,
            // se der erro, mudar para false em dev e em prod mudar para true
            secure: true,
            sameSite: "strict",
            maxAge: 3600000,
            path: "/"
        })


        // GERAR INTERFACE
        // CSRf Token
        const csrfToken = crypto.randomUUID()
        res.cookie("csrf_token", csrfToken, {
            httpOnly: false,
            secure: true,
            sameSite: "strict",
            maxAge: 3600000
        })

        // const userInfo = {
        //     spotifyId: user.spotifyId,
        //     access_token: tokens.access_token,
        //     refresh_token: tokens.refresh_token
        // }

        // redis.set(`spotify:${user}`, JSON.stringify(userInfo), "EX", 60 * 60)

        // const fullProfile: SpotifyFullProfile = { ...tokens, ...user }

        // const savedProfile = await new SpotifyAuthService().saveFullProfileInfo(fullProfile)

        res.json({
            message: "Login Successful",
            csrf_token: csrfToken, // frontend guarda para enviar nas requisições
            user: {
                id: user.spotifyId,
                name: user.display_name
            }
        })
    }
}

