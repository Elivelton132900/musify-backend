import axios from "axios"
import { lastFmMapper } from "../utils/lastFmMapper"
import { SearchFor, tracksRecentTracks } from "../models/last-fm.model"
import { getTracksByAccountPercentage } from "../utils/lastFmUtils";
import { LastFmRepository } from "../repositories/last-fm.repository";
import { LastFmFullProfile } from "../models/last-fm.auth.model";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

export class LastFmService {

    private LastFmRepository: LastFmRepository;

    constructor() {
        this.LastFmRepository = new LastFmRepository()
    }



    async getUserByUsername(userLastFm: string) {
        const user = await this.LastFmRepository.getUserByName(userLastFm)
        return user

    }

    async getTracksByPercentage(percentage: number, user: LastFmFullProfile, endpoint: string) {
        const creationAccountUnixDate = user.registered.unixtime

        const { fromDate, toDate } = getTracksByAccountPercentage(creationAccountUnixDate, percentage)

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

        return lastFmMapper.toRecentAndOldTracksData(response)

    }

    async getTopOldTracksPercentage(userLastFm: string, percentage: number) {
        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))

        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const oldTracks = this.getTracksByPercentage(percentage, user, endpoint)

        return oldTracks
    }

    async getTopRecentTrack(userLastFm: string, percentage: SearchFor) {

        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))

        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const recentTracks = this.getTracksByPercentage(percentage, user, endpoint)

        return recentTracks

    }

}