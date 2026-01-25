import "../infra/firebase";

import { Worker } from "bullmq";
import { redis } from "../infra/redis";
import { LastFmFetcherService } from "../services/last-fm-fetcher.service";

const service = new LastFmFetcherService()

export const rediscoverWorker = new Worker(
    "rediscover-loved-tracks",
    async job => {
        const {
            user,
            params
        } = job.data

        const controller = new AbortController()
        const result = await service.rediscoverLovedTracks(
            user,
            params.limit,
            params.fetchInDays,
            params.distinct,
            params.maximumScrobbles,
            params.candidateFrom,
            params.candidateTo,
            params.comparisonFrom,
            params.comparisonTo,
            params.minimumScrobbles,
            controller.signal,
            params.order
        )

        // cache do resultado
        await redis.set(
            `rediscover:result:${user}`,
            JSON.stringify(result),
            "EX",
            60*60
        )

        return result
    },
    {
        connection: redis,
        concurrency: 1
    }
)