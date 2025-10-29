import { SpotifyTrackAPI, TrackData } from "../models/spotify.model";

export const SpotifyMapper = {
  toTrackData(track: SpotifyTrackAPI): TrackData {
    return {
      id: track.id,
      name: track.name,
      type: track.type,
      album: {
        external_urls: track.album.external_urls,
        images: track.album.images,
        name: track.album.name,
        type: track.album.type,
      },
      artists: track.artists.map((a) => ({
        external_urls: a.external_urls,
        name: a.name,
        type: a.type,
      })),
    };
  },
};