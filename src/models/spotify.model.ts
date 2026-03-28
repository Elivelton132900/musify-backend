import { SpotifyFullProfile } from "./spotify.auth.model"
export type SaveProfileResult =
    | { status: "created"; user: SpotifyFullProfile }
    | { status: "token_refreshed"; user: SpotifyFullProfile }
    | { status: "already_exists"; user: SpotifyFullProfile };

export enum TimeRange {
    short = "short_term",
    medium = "medium_term",
    long = "long_term"
}

export interface SpotifyArtistsAPI {
    external_urls: {
        spotify: string
    },
    href?: string,
    id?: string,
    name: string,
    type: string,
    uri?: string
}[]

interface SpotifyImage {
    height: number;
    url: string;
    width: number;
}

export interface SpotifyAlbumAPI {
    album_type?: string,
    artists?: SpotifyArtistsAPI[]
    available_markets?: string[],
    external_urls?: {
        spotify: string
    },
    href?: string,
    id?: string,
    images: SpotifyImage[],
    is_playable?: boolean,
    name: string,
    release_date?: string,
    release_date_precision?: string,
    total_tracks?: number,
    type?: string
    uri?: string
}

export interface SpotifyTrackAPI {
    album: SpotifyAlbumAPI,
    artists: SpotifyArtistsAPI[]
    avaiable_markets: string[],
    disc_number: number,
    duration_ms: number,
    explicit: boolean,
    external_ids: {
        isrc: string
    },
    external_urls: {
        spotify: string
    },
    href: string,
    id: string,
    is_local: boolean,
    is_playable: boolean,
    name: string,
    popularity: number,
    preview_url: null | string,
    track_number: number,
    type: string,
    uri: string
}

export interface SpotifyFullReturnAPI {
 
        items: SpotifyTrackAPI[],
        total: number,
        limit: number,
        offset: number,
        href: string,
        next: string | null,
        previous: string | null

}

interface CostumizedSpotifyAlbum extends Pick<SpotifyAlbumAPI, "name" | "images"> {
    images:{
            height: number,
            url: string,
            width: number
        }[]
    ,
    name: string,
}

interface CostumizedArtists extends Pick<SpotifyArtistsAPI, "name" | "external_urls"> {
    name: string,
    external_urls: {
        spotify: string
    }
}

export interface TrackDataSpotify {
    id: string
    external_urls: string,
    name?: string,
    album: CostumizedSpotifyAlbum,
    artists?: CostumizedArtists[]
}

