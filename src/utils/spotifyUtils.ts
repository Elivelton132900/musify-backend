import querystring from "querystring";
import axios from 'axios';
import { RefreshToken, SpotifyCredentials, SpotifyUserProfileInfo } from '../models/auth.model';
import { dayjs } from "./dayJsConfig"
import { TrackData } from "../models/spotify.model";

export function getLoginUrl(): string {
    const scope = "user-read-email user-read-private user-top-read"
    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        scope,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI_LOGIN!
    })

    return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export function returnDateExpiresin(expires_in: number) {
    const brasiliaTZ = "America/Sao_Paulo"
    const now = dayjs().tz(brasiliaTZ)
    return now.add(expires_in, "second").toDate()
}

export async function exchangeCodeForToken(code: string): Promise<SpotifyCredentials> {

    const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        querystring.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI_LOGIN,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET
        }),
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
    )

    const spotifyCredentials = new SpotifyCredentials(response.data)

    return {
        ...spotifyCredentials,
        expires_in: returnDateExpiresin(Number(spotifyCredentials.expires_in))
    }
}


export async function getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfileInfo> {
    const response = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    return {
        ...response.data,
        spotifyId: response.data.id,
    }
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
    return response.data
}

export function hasTimePassed(expires_in: Date): boolean {
    const expires_in_dayjs = dayjs(expires_in).tz("America/Sao_Paulo")

    const now = dayjs().tz("America/Sao_Paulo")

    return now.isAfter(expires_in_dayjs)

}

export function compareRanges(firstRange: TrackData[], secondRange: TrackData[]) {

    const noMoreListenedTracks = firstRange.filter((track) => {
        const isStillListened =  secondRange.some((t) => t.id === track.id)
        return !isStillListened
    })

    console.log("\n\n\nno more: ", noMoreListenedTracks)

    return noMoreListenedTracks

}