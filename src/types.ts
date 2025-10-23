// import { AxiosResponse } from "axios";

export interface SpotifyCredentials {
    access_token: string,
    token_type: string,
    expires_in: number
    refresh_token: string,
    scope: string
}

 export interface SpotifyUserProfileInfo {
    country: string,
    display_name: string,
    email: string,
    explicit_content: {
        filter_enabled: boolean,
        filter_locked: boolean
    },
    external_urls: {
        spotify: string
    },
    followers: {
        href: null,
        total: number
    },
    href: string,
    id: string,
    images: [
        {
            height: number,
            url: string,
            width: number
        },
        {
            height: number,
            url: string,
            width: number
        }
    ],
    product: string,
    type: string,
    uri: string
}