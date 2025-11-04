import { LastFmFetcherService } from "./last-fm-fetcher.service.js";
import { LastFmRepository } from "../repositories/last-fm.repository";
import { LastFmFullProfile } from "../models/last-fm.auth.model";
import { LastFmLogicService } from "./last-fm-logic.service.js";

export class LastFmService {


    private readonly lastFmRepository: LastFmRepository;
    private readonly fetcher: LastFmFetcherService
    private readonly logic: LastFmLogicService
    constructor() {

        this.lastFmRepository = new LastFmRepository()
        this.fetcher = new LastFmFetcherService()
        this.logic = new LastFmLogicService()
    }



    async getUserByUsername(userLastFm: string) {
        const user = await this.lastFmRepository.getUserByName(userLastFm)
        return user

    }

    async getTracksByPercentage(username: LastFmFullProfile, percentage: number, offset: number, windowValueToFetch: number, limit: number) {
        return this.fetcher.getTracksByPercentage(percentage, username, limit, windowValueToFetch, offset);
    }

    async getPlaycountOfTrack(user: string, musicName: string, artistName: string) {
        const userFullProfile = await this.getUserByUsername(user) as LastFmFullProfile
        return this.fetcher.getPlaycountOfTrack(userFullProfile, musicName, artistName)
    }


    async getTopOldTracksPercentage(userLastFm: string, percentage: number, limit: number) {
        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))

        const offset = 0
        const windowValueToFetch = 10

        const oldTracks = await this.getTracksByPercentage(user, percentage, offset, windowValueToFetch, limit)

        return oldTracks
    }

    async getTopRecentTrack(userLastFm: string, recentYears: number, limit: number) {
        const userFullProfile = await this.getUserByUsername(userLastFm) as LastFmFullProfile

        return this.fetcher.getTopRecentTrack(userFullProfile, recentYears, limit)
    }

    async resolveRediscoverList(percentageSearchFor: string, userLastFm: string, limit: number) {
        return await this.logic.resolveRediscoverList(percentageSearchFor, userLastFm, limit)
    }

    async getTopTracksAllTime(username: string, limit: string) {
        return await this.fetcher.getTopTracksAllTime(username, limit)
    }

}