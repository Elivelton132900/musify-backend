import axios from "axios"
import dotenv from "dotenv";
import querystring from "querystring";
import { SpotifyCredentials, SpotifyUserProfileInfo } from "../types";

dotenv.config()

export class AuthService {

    static getLoginUrl(): string {
        const scope = "user-read-email user-read-private"
        const params = new URLSearchParams({
            response_type: "code",
            client_id: process.env.SPOTIFY_CLIENT_ID!,
            scope,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
        })

        return `https://accounts.spotify.com/authorize?${params.toString()}`
    }

    static async exchangeCodeForToken(code: string): Promise<SpotifyCredentials> {
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            querystring.stringify({
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
                client_id: process.env.SPOTIFY_CLIENT_ID,
                client_secret: process.env.SPOTIFY_CLIENT_SECRET
            }),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }
        )


        return response.data
    }

    static async getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfileInfo> {
        const response = await axios.get("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        console.log("getSpotifyUserProfile", response.data)

        return response.data
    }
}