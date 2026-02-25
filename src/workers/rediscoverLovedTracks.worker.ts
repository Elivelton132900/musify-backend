import 'dotenv/config';


import "../infra/firebase";

import { Worker } from "bullmq";
import { redis } from "../infra/redis";
import { LastFmService } from "../services/last-fm.service";
import { buildCacheKey, buildLockKey, JobCanceledError, throwIfCanceled } from "../utils/lastFmUtils";
import { RediscoverLovedTracksQuery } from "../models/last-fm.model";
import { rediscoverQueueEvents } from '../queues/rediscoverLovedTracks.queue';


const service = new LastFmService()

const abortControllers = new Map<string, AbortController>()

export const rediscoverWorker = new Worker(
    "rediscover-loved-tracks",
    async job => {

        if (job.name !== "rediscover-loved-tracks") return;

        const {
            user,
            params,
            hash
        } = job.data as {
            user: string,
            params: RediscoverLovedTracksQuery,
            hash: string,
            jobId: string
        }


        const lockKey = buildLockKey(user, hash)
        const cacheKey = buildCacheKey(user, hash)

        const controller = new AbortController()
        abortControllers.set(job.id!, controller)
        const { signal } = controller

        await throwIfCanceled(job!, signal)

        try {

            const result = await service.rediscoverLovedTracks(
                user,
                params,
                signal,
                job
            )
            // cache do resultado
            if (signal.aborted) return
            if (!result || (Array.isArray(result) && result.length === 0)) {
                console.warn("Resultado vazio ou inválido, não salvando cache", {
                    cacheKey,
                    user,
                    params
                })
                return result
            }

            await redis.set(
                cacheKey,
                JSON.stringify(result),
                "EX",
                60 * 60
            )
            if (signal.aborted) return
            return result
        } catch (e: any) {
            if (e instanceof JobCanceledError) {
                console.log("Job cancelado corretamente por: ", job.id)
                return
            }
            console.log("Ocorreu algum erro: ", e)
            throw e
        } finally {
            await redis.del(lockKey)
        }
    },
    {
        connection: redis,
        concurrency: 1,
        maxStalledCount: 50 // quando descomentar playcount, aumentar para testar performance
    }
)


rediscoverWorker.on("ready", () => {
    console.log("estou pronto ")
})

rediscoverWorker.on ("failed", (job, err) => {
    console.error("Job falhou", job?.id, err)
})

rediscoverQueueEvents.on("removed", ({ jobId }) => {
    const controller = abortControllers.get(jobId)
    if (controller) {
        console.log("Job removido, abortando execução: ", jobId)
        controller.abort()
        abortControllers.delete(jobId)
    }

})