import { SpotifyTrackAPI, TrackDataSpotify } from "../models/spotify.model";

export const SpotifyMapper = {
  toTrackData(track: SpotifyTrackAPI): TrackDataSpotify {
    return {
      id: track.id,
      external_urls: track.external_urls.spotify,
      name: track.name,
      album: {
        images: [track.album.images?.[2]],
        name: track.album.name
      },
      artists: track.artists.map((a) => ({
        external_urls: a.external_urls,
        name: a.name,
      })),
    };
  },
};