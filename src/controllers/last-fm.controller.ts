import { Request, Response } from "express"
import { RediscoverLovedTracksQuery, } from "../models/last-fm.model"
import { buildCacheKey, buildLockKey, buildRediscoverCacheKey } from "../utils/lastFmUtils"
import { redis } from "../infra/redis"
import { rediscoverQueue, rediscoverQueueEvents } from "../queues/rediscoverLovedTracks.queue"


export class LastFmController {


  static async rediscoverLovedTracks(req: Request, res: Response) {
    const controller = new AbortController()
    const { signal } = controller

    req.on("close", () => {
      controller.abort()
    })

    try {

      const userLastFm = req.session.lastFmSession?.user as string
      const query = req.query as unknown as RediscoverLovedTracksQuery

      const {
        limit,
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
          comparisonTo
        }
      )

      console.log("HASH HHHHHHHHHHH ", hash)
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
        limit,
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

      // 4. esperar resultado

      const result = await job.waitUntilFinished(
        rediscoverQueueEvents,
      )

      if (signal.aborted) return

      res.status(200).json({
        mostListenedMusic: result,
        musicsRetrieved: result?.length,
        cached: false
      })

      controller.abort()

    } catch (err: any) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        console.log("🔕 Requisição cancelada")
        return
      }

      console.error(err)
      res.status(500).json({ error: "Internal server error" })
    }
  }
}