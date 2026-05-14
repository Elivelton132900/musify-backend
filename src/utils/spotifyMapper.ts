import { SpotifySavedTracks, SpotifyUserTopItems, TrackDataSpotify } from "../models/spotify.model"

export const SpotifyMapper = {
    toTopTrackData(track: SpotifyUserTopItems): TrackDataSpotify {
        return {
            id: track.id,
            external_urls: track.external_urls?.spotify ?? "",
            name: track.name ?? "Unknown Track",
            album: {
                images: track.album.images.filter((image) => image.height === 300),
                name: track.album.name,
            },
            artists: track.artists,
        }
    },
}

export const SpotifyMapperSavedTracks = {
    toTopTrackData(item: SpotifySavedTracks): TrackDataSpotify {
        const track = item.track
        return {
            added_at: item.added_at,
            id: track.id,
            external_urls: track.external_urls.spotify,
            name: track.name,
            album: {
                images: track.album.images.filter((image) => image.height === 300),
                name: track.album.name,
            },
            artists: track.artists,
        }
    },
}
