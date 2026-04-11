import { Joi } from "celebrate";
import { SpotifyFullProfile } from "./spotify.auth.model"
export type SaveProfileResult =
    | { status: "created"; user: SpotifyFullProfile }
    | { status: "token_refreshed"; user: SpotifyFullProfile }
    | { status: "already_exists"; user: SpotifyFullProfile };

export enum TimeRange {
    short = "short_term",
    medium = "medium_term",
    long = "long_term",
    loved_tracks = "loved_tracks"
}


export interface SpotifySavedTracks {
    added_at?: string,
    track: {
        id: string,
        added_at?: string,
        album: {
            external_urls: {
                spotify: string
            },
            images: {
                url: string,
                height: number,
                width: number
            }[]
            name: string
        }
        name: string,
        external_urls: {
            spotify: string
        }
        artists: {
            external_urls: {
                spotify: string
            }
            name: string
        }[]
    }
}


export interface PaginatedResponse<T> {
    href: string;
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    items: T[];
}

export interface SpotifyUserTopItems {
    id: string,
    external_urls: {
        spotify: string
    },
    name: string
    album: {
        images: {
            url: string,
            height: number,
            width: number
        }[],
        name: string
    },
    artists: {
        external_urls: {
            spotify: string,
        },
        name: string
    }[]
}
// apagar ?
// export interface SpotifyUserSavedTracks {
//     added_at: string,
//     id: string,
//     external_urls: {
//         spotify: string
//     }
//     name: string,
//     images: {
//         url: string,
//         height: number,
//         width: number
//     }[],
//     artists: {
//         external_urls: {
//             spotify: string,
//         },
//         name: string
//     }[]
// }

interface CostumizedSpotifyAlbum {
        images: {
            url: string,
            height: number,
            width: number
        }[],
        name: string,
}

interface CustomizedSpotifyArtist {
        external_urls: {
            spotify: string,
        },
        name: string
}

export interface TrackDataSpotify {
    added_at?: string,
    id: string,
    external_urls: string,
    name?: string,
    album: CostumizedSpotifyAlbum,
    artists?: CustomizedSpotifyArtist[]
}


export type RediscoverJobData = {
    access_token: string
    spotifyId: string
    compare: {
        firstCompare: TimeRange
        secondCompare: TimeRange
    }
}

export enum PossibleRanges {

    long_short = "long-short", //v
    long_medium = "long-medium", // v
    medium_short = "medium-short", // v
    long_loved = "long-loved_tracks",
    medium_loved = "medium-loved_tracks",
    short_loved = "short-loved_tracks"
}

export const comparationRange = Joi.object({
    range: Joi.string().valid(...Object.keys(PossibleRanges)).required()
})
