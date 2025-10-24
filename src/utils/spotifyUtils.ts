import querystring from "querystring";
import axios from 'axios';
import { RefreshToken, SpotifyCredentials, SpotifyUserProfileInfo } from '../models/auth.model';

export function getLoginUrl(): string {
    const scope = "user-read-email user-read-private"
    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!
    })

    return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<SpotifyCredentials> {
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

export async function getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfileInfo> {
    const response = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
    })
    console.log("getSpotifyUserProfile", response.data)

    return response.data
}

export async function refreshSpotifyToken(refresh_token: string) {
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
