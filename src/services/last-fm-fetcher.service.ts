import axios from "axios"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { lastFmMapper } from "../utils/lastFmMapper"
import { getTracksByAccountPercentage } from "../utils/lastFmUtils"
import { RecentTracks, topTracksAllTime } from "../models/last-fm.model"
import { LastFmFullProfile } from "../models/last-fm.auth.model"

export class LastFmFetcherService {

    private readonly endpoint = "https://ws.audioscrobbler.com/2.0/"

    constructor(
        private readonly mapper = lastFmMapper,
    ) {
    }

    async getTracksByPercentage(
        percentage: number,
        user: LastFmFullProfile,
        limit: number,
        windowValueToFetch: number,
        offset: number
    ) {
        const creationAccountUnixDate = user.registered.unixtime

        const { fromDate, toDate } = getTracksByAccountPercentage(
            creationAccountUnixDate,
            percentage,
            windowValueToFetch,
            offset
        )

        if(toDate.isAfter(dayjs(), "day")) {
            return []
        }

        dayjs.extend(utc)

        const responseTracks = await axios.get(this.endpoint, {
            params: {
                method: "user.getrecenttracks",
                limit,
                user: user.name,
                from: fromDate.unix(),
                to: toDate.unix(),
                api_key: process.env.LAST_FM_API_KEY,
                nowplaying: "true",
                format: "json",
            }
        }) as RecentTracks

        const tracksRaw = responseTracks.data.recenttracks?.track

        if (!tracksRaw) {
            console.warn(`[LastFmService] Nenhuma track encontrada no intervalo ${fromDate.format()} → ${toDate.format()}`);
            return [];
        }

        const tracksArray = Array.isArray(tracksRaw) ? tracksRaw : [tracksRaw];

        const addedPlaycount = await Promise.all(
            tracksArray.map(async (track) => {
                const playcountResponse = await this.getPlaycountOfTrack(
                    user,
                    track.name,
                    track.artist["#text"]
                )
                return {
                    ...track,
                    userplaycount: playcountResponse
                }
            })
        )


        return this.mapper.toRecentAndOldTracksData({ data: { recenttracks: { track: addedPlaycount } } })

    }

    async getTopOldTracksPercentage(user: LastFmFullProfile, percentage: number, limit: number) {

        const offset = 0
        const windowValueToFetch = 10

        const oldTracks = await this.getTracksByPercentage(percentage, user, limit, windowValueToFetch, offset)
        return oldTracks
    }


    async getTopRecentTrack(userLastFm: LastFmFullProfile, percentage: number, limit: number) {

        const windowValueToFetch = 10
        const offset = 0


        const recentTracks = await this.getTracksByPercentage(percentage, userLastFm, limit, windowValueToFetch, offset)
        return recentTracks

    }

    async getTopTracksAllTime(username: string, limit: string) {
        const response = await axios.get(this.endpoint, {
            params: {
                method: "user.gettoptracks",
                format: "json",
                user: username,
                period: "overall",
                limit,
                api_key: process.env.LAST_FM_API_KEY
            }
        }) as topTracksAllTime

        return response.data
    }
 
    async getPlaycountOfTrack(user: LastFmFullProfile, musicName: string, artistName: string) {
        const response = await axios.get(this.endpoint, {
            params: {
                method: "track.getInfo",
                username: user.name,
                track: musicName,
                artist: artistName,
                format: "json",
                api_key: process.env.LAST_FM_API_KEY
            }
        })

        const userPlaycount = response.data.track?.userplaycount ?? "0"
        return userPlaycount
    }

}