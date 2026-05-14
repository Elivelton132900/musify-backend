import { lastFmFusionFormat } from "../models/fusion.model";
import { TrackDataLastFm } from "../models/last-fm.model";
import { TimeRange } from "../models/spotify.model";

export const fusionMapper = {
    lastFmToFusionFormat(
        spotifyHistory: TrackDataLastFm[], 
        compare: { firstCompare: TimeRange; secondCompare: TimeRange.loved_tracks }): lastFmFusionFormat[] 
        {

        const LastFmFormatted: lastFmFusionFormat[] = []

        spotifyHistory.map(track => {
            const name = track.name
            const artist = track.artist
            const date = track.date["#text"]

            const obj = {name, artist, date, compare}
            LastFmFormatted.push(obj)
        })

        return LastFmFormatted

    }
} 