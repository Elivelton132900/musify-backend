import { LastFmFetcherService } from "./last-fm-fetcher.service.js";
import { LastFmRepository } from "../repositories/last-fm.repository";
import { LastFmFullProfile } from "../models/last-fm.auth.model";
import { LastFmLogicService } from "./last-fm-logic.service.js";
import { calculateWindowValueToFetch, getTracksByAccountPercentage } from "../utils/lastFmUtils.js";
import dayjs from "dayjs";

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

        const {fromDate, toDate} = getTracksByAccountPercentage(
            Number(username.registered.unixtime),
            percentage, 
            windowValueToFetch, 
            offset
        )
        
        const page = 1

        return this.fetcher.getTracksByPercentage(percentage, username, limit, offset, page, windowValueToFetch, fromDate, toDate );
    }

    async getPlaycountOfTrack(user: string, musicName: string, artistName: string) {
        const userFullProfile = await this.getUserByUsername(user) as LastFmFullProfile
        return this.fetcher.getPlaycountOfTrack(userFullProfile, musicName, artistName)
    }


    async getTopOldTracksPercentage(userLastFm: string, percentage: number, limit: number) {
        const user = new LastFmFullProfile(await this.getUserByUsername(userLastFm))

        const offset = 0
        const totalScrobbles = await this.lastFmRepository.getTotalScrobbles(typeof user === "string" ? user : user.name)
        const windowValueToFetch = calculateWindowValueToFetch(totalScrobbles)

        const oldTracks = await this.getTracksByPercentage(user, percentage, offset, windowValueToFetch, limit)
        return oldTracks
    }
    
    async getTopRecentTrack(userLastFm: string, recentYears: number, limit: number) {
        const userFullProfile = await this.getUserByUsername(userLastFm) as LastFmFullProfile

        return this.fetcher.getTopRecentTrack(userFullProfile, recentYears, limit, dayjs().utc().unix(), dayjs().utc().unix())
    }

    async resolveRediscoverList(percentageSearchFor: number, userLastFm: string, limit: number) {
        return await this.logic.resolveRediscoverList(percentageSearchFor, userLastFm, limit)
    }

    async getTopTracksAllTime(username: string, limit: string) {
        return await this.fetcher.getTopTracksAllTime(username, limit)
    }

    async rediscoverLovedTracks(
        username: string, 
        limit: number, 
        percentage: number, 
        fetchInDays: number, 
        fetchForDistinct: number | boolean, 
        maximumScrobbles: boolean | number,
        searchPeriodFrom: boolean | string,
        searchPeriodTo: boolean | string
    ) {
        return await this.fetcher.rediscoverLovedTracks(username, limit, percentage, fetchInDays, fetchForDistinct, maximumScrobbles, searchPeriodFrom, searchPeriodTo)
    }

}