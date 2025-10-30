import { LastFmTopTracks, TrackDataLastFm } from "../models/last-fm.model";

export const lastFmMapper = {
  toTrackData(track: LastFmTopTracks): TrackDataLastFm[] {

    return track.tracks.map((t) => ({
      artist: t.artist.name,
      name: t.name,
      playcount: t.playcount,
      url: t.url
    }))

  },
};