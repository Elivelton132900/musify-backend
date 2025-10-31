import axios from "axios"
import { lastFmMapper } from "../utils/lastFmMapper"
import { LastFmTopTracks, LastFmTopTracksAttr, LastFmTrack, TrackDataLastFm, tracksRecentTracks } from "../models/last-fm.model"
import { getTracksByAccountPercentage } from "../utils/lastFmUtils";
import { LastFmRepository } from "../repositories/last-fm.repository";
import { LastFmFullProfile } from "../models/last-fm.auth.model";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

export class LastFmService {

    private LastFmRepository: LastFmRepository;

    constructor () {
        this.LastFmRepository = new LastFmRepository()
    }

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

    async getUserByUsername(userLastFm: string) {
        const user = await this.LastFmRepository.getUserByName(userLastFm)
        return user

    }

    async getTopTracksByDate(userLastFm: string) {
        const user = new LastFmFullProfile( await this.getUserByUsername(userLastFm))

        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const creationAccountUnixDate = user.registered.unixtime

        const {fromDate, toDate} = getTracksByAccountPercentage(creationAccountUnixDate, 5)

        dayjs.extend(utc)

        const response = await axios.get(endpoint, {
            params: {
                method: "user.getrecenttracks",
                limit: 1,
                user: user.name,
                from: fromDate.unix(),
                to: toDate.unix(),
                api_key: process.env.LAST_FM_API_KEY,
                nowplaying: "true",
                format: "json",
            }
        }) as tracksRecentTracks

        const mappedRecentTracks = lastFmMapper.toRecentTracksData(response)

        console.log(JSON.stringify(mappedRecentTracks, null, 10))
    }

}