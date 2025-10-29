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

export interface SpotifyAlbumAPI {
    album_type?: string,
    artists?: SpotifyArtistsAPI[]
    available_markets?: string[],
    external_urls?: {
        spotify: string
    },
    href?: string,
    id?: string,
    images?: {
        height: number,
        url: string
        width: number
    }[],
    is_playable?: boolean,
    name?: string,
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

export interface TrackData {
    type?: string,
    name?: string,
    id?: string,
    album?: SpotifyAlbumAPI,
    artists?: SpotifyArtistsAPI[]
}