import { TrackDataLastFm, RecentTracks } from "../models/last-fm.model";

export const lastFmMapper = {

  toRecentAndOldTracksData(tracks: RecentTracks[]): TrackDataLastFm[] {

   const allTracks = tracks
    .flatMap(t => t?.recenttracks?.track ?? [])
    .filter(Boolean); // remove undefined/null


    return allTracks.filter((track) => (
      Boolean(track["@attr"]?.nowplaying) !== true
    )).map((track) => ({
      artist: track.artist["#text"] || "",
      name: track.name,
      url: track.url,
      userplaycount: track.userplaycount,
      mbid: track.mbid,
      date: track.date,
    })).sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
  }
}