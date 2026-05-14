import { DateRecentTracks, TrackDataLastFm, trackRecentData } from "../models/last-fm.model";

export const lastFmMapper = {

    recentDataToTrackData(lastFmHistory: trackRecentData[]): TrackDataLastFm[] {

        return lastFmHistory.map(track => ({
            artist: track.artist["#text"],
            name: track.name,
            userplaycount: 0,
            url: track.url,
            mbid: track.mbid,
            date: track.date as DateRecentTracks,
            key: track.key
        }))
    }

}