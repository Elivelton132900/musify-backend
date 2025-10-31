import { LastFmTopTracks, TrackDataLastFm, tracksRecentTracks } from "../models/last-fm.model";

export const lastFmMapper = {
  toTrackData(track: LastFmTopTracks): TrackDataLastFm[] {

    return track.tracks.map((t) => ({
      artist: t.artist.name,
      name: t.name,
      playcount: t.playcount,
      url: t.url
    }))
  },

  toRecentTracksData(tracks: tracksRecentTracks): TrackDataLastFm[] {
    return tracks.data.recenttracks.track.filter((track) => (
      Boolean(track["@attr"]?.nowplaying) !== true
    )).map((track) => ({
      artist: track.artist["#text"] || "",
      name: track.name,
      url: track.url,
    }))
  }
};