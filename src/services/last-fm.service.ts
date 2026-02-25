import { LastFmFetcherService } from "./last-fm-fetcher.service.js";
import { RediscoverLovedTracksQuery } from "../models/last-fm.model.js";
import { Job } from "bullmq";

export class LastFmService {


    private readonly fetcher: LastFmFetcherService
    constructor() {
        this.fetcher = new LastFmFetcherService()
    }

    async rediscoverLovedTracks(
        username: string, 
        queryParams: RediscoverLovedTracksQuery,
        signal: AbortSignal,
        job: Job
    ) {
        return await this.fetcher.rediscoverLovedTracks(
            username, 
            queryParams.fetchInDays, 
            queryParams.distinct, 
            queryParams.maximumScrobbles, 
            queryParams.candidateFrom, 
            queryParams.candidateTo,
            queryParams.comparisonFrom,
            queryParams.comparisonTo,
            queryParams.minimumScrobbles,
            signal,
            queryParams.order!,
            job
        )
    }


}