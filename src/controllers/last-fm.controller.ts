import { Request, Response } from "express"
import { RediscoverLovedTracksQuery, TrackDataLastFm, } from "../models/last-fm.model"
import { buildCacheKey, buildLockKey, buildRediscoverCacheKey, JobCanceledError } from "../utils/lastFmUtils"
import { redis } from "../infra/redis"
import { rediscoverQueue, rediscoverQueueEvents } from "../queues/rediscoverLovedTracks.queue"


export class LastFmController {


  static async rediscoverLovedTracks(req: Request, res: Response) {
    const controller = new AbortController()
    const { signal } = controller

    try {

      const userLastFm = req.session.lastFmSession?.user as string
      const query = req.query as unknown as RediscoverLovedTracksQuery

      const {
        fetchInDays,
        distinct,
        maximumScrobbles,
        candidateFrom,
        candidateTo,
        comparisonFrom,
        comparisonTo,
        minimumScrobbles,
        order
      } = query




      const hash = buildRediscoverCacheKey(
        userLastFm,
        {
          candidateFrom,
          candidateTo,
          comparisonFrom,
          comparisonTo,
          distinct,
          fetchInDays,
          maximumScrobbles,
          minimumScrobbles
        }
      )

      const cacheKey = buildCacheKey(userLastFm, hash)
      const lockKey = buildLockKey(userLastFm, hash)

      // 1. cache

      const cached = await redis.get(cacheKey)

      if (cached) {
        res.status(200).json({
          mostListenedMusic: JSON.parse(cached),
          cached: true
        })
        return
      }

      // 2. lock

      while (await redis.get(lockKey)) {
        await new Promise(r => setTimeout(r, 500))
        if (signal.aborted) return
      }


      await redis.set(lockKey, "1", "EX", 180)


      // 3. fila

      const params = {
        fetchInDays,
        distinct,
        maximumScrobbles,
        candidateFrom,
        candidateTo,
        comparisonFrom,
        comparisonTo,
        minimumScrobbles,
        order
      } as RediscoverLovedTracksQuery

      const job = await rediscoverQueue.add(
        "rediscover-loved-tracks",
        {
          user: userLastFm,
          params,
          hash
        },
        {
          removeOnComplete: true,
          removeOnFail: true
        }
      )


      req.on("close", () => {
        controller.abort()

        if (job?.id) {
          redis.set(`rediscover:cancel:${job.id}`, "1", "EX", 300)
        }
        console.log("Job marcado como cancelado. ", job.id)
      })

      // 4. esperar resultado

      const result: TrackDataLastFm[] = await job.waitUntilFinished(
        rediscoverQueueEvents,
      )


      if (signal.aborted) throw new JobCanceledError()

      res.status(200).json({
        mostListenedMusic: result,
        musicsRetrieved: result.length,
        cached: false
      })

      controller.abort()

    } catch (err: any) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        console.log(" Requisição cancelada")
        return
      }

      console.error(err)
      res.status(500).json({ error: "Internal server error" })
    }
  }
}