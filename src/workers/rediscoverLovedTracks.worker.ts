import 'dotenv/config';


import "../infra/firebase";

import { Worker } from "bullmq";
import { redis } from "../infra/redis";
import { LastFmService } from "../services/last-fm.service";
import { buildCacheKey, buildLockKey } from "../utils/lastFmUtils";
import { RediscoverLovedTracksQuery } from "../models/last-fm.model";


const service = new LastFmService()

export const rediscoverWorker = new Worker(
    "rediscover-loved-tracks",
    async job => {

        console.log("entrei 0")
        if (job.name !== "rediscover-loved-tracks") return;

        const {
            user,
            params,
            hash
        } = job.data as {
            user: string,
            params: RediscoverLovedTracksQuery,
            hash: string
        }

        const lockKey = buildLockKey(user, hash)
        const cacheKey = buildCacheKey(user, hash)

        const { signal } = new AbortController()


        try {

            console.log("entrei 1, userrrrrrrrr ", user, hash)
            console.log("params ", JSON.stringify(params, null, 5))
            const result = await service.rediscoverLovedTracks(
                user,
                params,
                signal
            )
            console.log("entrei 2")
            // cache do resultado
            if (signal.aborted) return
            if (!result || (Array.isArray(result) && result.length === 0)) {
                console.warn("⚠️ Resultado vazio ou inválido, não salvando cache", {
                    cacheKey,
                    user,
                    params
                })
                return result
            }
            console.log("📊 RESULT TYPE:", typeof result)
            console.log("📊 RESULT TYPE:", typeof result)

            console.log("📦 RESULT VALUE:", result)
            console.log("📏 RESULT LENGTH:", Array.isArray(result) ? result.length : "n/a")
            await redis.set(
                cacheKey,
                JSON.stringify(result),
                "EX",
                60 * 60
            )
            console.log("entrei 3")
            if (signal.aborted) return
            return result
        }
        finally {
            await redis.del(lockKey)
            if (signal.aborted) return
        }
    },
    {
        connection: redis,
        concurrency: 1,
        maxStalledCount: 20 // quando descomentar playcount, aumentar para testar performance
    }
)


rediscoverWorker.on("ready", () => {
    console.log("estou pronto ")
})
rediscoverWorker.on("failed", (job, err) => {
    console.error("❌ Job falhou", job?.id, err)
})