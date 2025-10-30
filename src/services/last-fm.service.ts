import axios from "axios"
import { lastFmMapper } from "../utils/lastFmMapper"
import { LastFmTopTracks, LastFmTopTracksAttr, LastFmTrack, TrackDataLastFm } from "../models/last-fm.model"

export class LastFmService {

    async getTopTracks(limit: number, user: string): 
    Promise< 
    { toptracks: { track: LastFmTrack[]; "@attr": LastFmTopTracksAttr } } 
    > {
        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const api_key = process.env.LAST_FM_API_KEY
        const response = await axios.get(endpoint, {
            params: {
                method: "user.gettoptracks",
                api_key,
                format: "json",
                user,
                limit,
                period: "overall"
            }
        })

        const data = response.data

        return data
    }

    syncTopMusicLastFm(tracks: LastFmTopTracks): TrackDataLastFm[] {

        const mappedTracks = lastFmMapper.toTrackData(tracks)
        return mappedTracks
    }

}