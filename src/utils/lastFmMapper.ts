import { TrackDataLastFm, tracksRecentTracks } from "../models/last-fm.model";

export const lastFmMapper = {

  toRecentAndOldTracksData(tracks: tracksRecentTracks): TrackDataLastFm[] {


    return tracks.data.recenttracks.track.filter((track) => (
      Boolean(track["@attr"]?.nowplaying) !== true
    )).map((track) => ({
      artist: track.artist["#text"] || "",
      name: track.name,
      url: track.url,
      playcount: track.playcount,
      mbid: track.mbid
    })).sort((a, b) => Number(b.playcount) - Number(a.playcount))
  }
};