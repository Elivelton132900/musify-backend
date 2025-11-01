import axios from "axios"
import { lastFmMapper } from "../utils/lastFmMapper"
import { Playcount, SearchFor, tracksRecentTracks } from "../models/last-fm.model"
import { getTracksByAccountPercentage } from "../utils/lastFmUtils";
import { LastFmRepository } from "../repositories/last-fm.repository";
import { LastFmFullProfile } from "../models/last-fm.auth.model";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

export class LastFmService {


    private endpoint: string
    private LastFmRepository: LastFmRepository;

    constructor() {
        this.LastFmRepository = new LastFmRepository()
        this.endpoint = "https://ws.audioscrobbler.com/2.0/"
    }



    async getUserByUsername(userLastFm: string) {
        const user = await this.LastFmRepository.getUserByName(userLastFm)
        return user

    }


    async getPlaycountOfTrack(user: string, mbid: string) {
        const response = await axios.get(this.endpoint, {
            params: {
                method: "track.getInfo",
                username: user,
                mbid,
                format: "json",
                api_key: process.env.LAST_FM_API_KEY
            }
        })

        return response.data as Playcount
    }

    async getTracksByPercentage(percentage: number, user: LastFmFullProfile) {
        const creationAccountUnixDate = user.registered.unixtime

        const { fromDate, toDate } = getTracksByAccountPercentage(creationAccountUnixDate, percentage)

        dayjs.extend(utc)

        const responseRecentTracks = await axios.get(this.endpoint, {
            params: {
                method: "user.getrecenttracks",
                limit: 4,
                user: user.name,
                from: fromDate.unix(),
                to: toDate.unix(),
                api_key: process.env.LAST_FM_API_KEY,
                nowplaying: "true",
                format: "json",
            }
        }) as tracksRecentTracks

        const addedPlaycount = await Promise.all(
            responseRecentTracks.data.recenttracks.track.map(async (track) => {
                const playcountResponse = await this.getPlaycountOfTrack(user.name, track.mbid)

                return {
                    ...track,
                    playcount: playcountResponse.track.userplaycount
                }
            })
        )


        return lastFmMapper.toRecentAndOldTracksData({ data: { recenttracks: { track: addedPlaycount } } })

    }

    async getTopOldTracksPercentage(userLastFm: string, percentage: number) {
        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))


        const oldTracks = this.getTracksByPercentage(percentage, user)

        return oldTracks
    }

    async getTopRecentTrack(userLastFm: string, percentage: SearchFor) {

        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))


        const recentTracks = this.getTracksByPercentage(percentage, user)

        return recentTracks

    }

}