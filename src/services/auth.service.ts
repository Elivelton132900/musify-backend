import { SpotifyUserProfileInfo, SpotifyCredentials, RefreshToken, SpotifyFullProfile } from './../models/auth.model';
import axios from "axios"
import dotenv from "dotenv";
import querystring from "querystring";
import { AuthRepository } from '../repositories/auth.repository';

dotenv.config()

export class AuthService {

    private authRepository: AuthRepository;

    constructor() {
        this.authRepository = new AuthRepository()
    }

    getLoginUrl(): string {
        const scope = "user-read-email user-read-private"
        const params = new URLSearchParams({
            response_type: "code",
            client_id: process.env.SPOTIFY_CLIENT_ID!,
            scope,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
        })

        return `https://accounts.spotify.com/authorize?${params.toString()}`
    }

    async exchangeCodeForToken(code: string): Promise<SpotifyCredentials> {
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

    async getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfileInfo> {
        const response = await axios.get("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        console.log("getSpotifyUserProfile", response.data)

        return response.data
    }

    async refreshSpotifyToken(refresh_token: string) {
        const refreshData: RefreshToken = {
            grant_type: "refresh_token",
            refresh_token,
            client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
            client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
        }

        const params = new URLSearchParams(refreshData)
    
        const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            params,
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        console.log("refreshSpotify", response.data)
        return response.data
    }

    async saveFullProfileDB(profile: SpotifyFullProfile) {
        await this.authRepository.saveFullProfileInfo(profile)
    }
}