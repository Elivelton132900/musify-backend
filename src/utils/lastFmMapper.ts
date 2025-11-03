import { TrackDataLastFm, RecentTracks } from "../models/last-fm.model";

export const lastFmMapper = {

  toRecentAndOldTracksData(tracks: RecentTracks): TrackDataLastFm[] {


    return tracks.data.recenttracks.track.filter((track) => (
      Boolean(track["@attr"]?.nowplaying) !== true
    )).map((track) => ({
      artist: track.artist["#text"] || "",
      name: track.name,
      url: track.url,
      userplaycount: track.userplaycount,
      mbid: track.mbid
    })).sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
  }


}