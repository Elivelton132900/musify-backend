import { Request, Response } from "express"
import { ObjectId, RediscoverLovedTracksQuery } from "../models/last-fm.model"
import { buildRediscoverCacheKey } from "../utils/lastFmUtils"
import { rediscoverQueue } from "../queues/rediscoverLovedTracks.queue"
import { redis } from "../infra/redis"

export class LastFmController {


  static async rediscoverLovedTracks(req: Request, res: Response) {
    try {



      //const userLastFm = req.session.lastFmSession?.user as string
      const userLastFm = "Elivelton1329"
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
      console.log("PARAMS: ", params)
      const job = await rediscoverQueue.add(
        "rediscover-loved-tracks",
        {
          user: userLastFm,
          params,
          hash
        },
        {
          removeOnComplete: {
            age: 60 * 60 * 24 * 10
          },
          removeOnFail: false
        }
      )

      res.status(202).json({
        jobId: job.id,
        status: "processing"
      })

    } catch (err: any) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        console.log(" Requisição cancelada")
        return
      }

      console.error(err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  static async getRediscoverStatus(req: Request, res: Response) {
    console.log("REQ QUERY ", req.query)
    const query = req.query as unknown as ObjectId
    const { jobId } = query

    const job = await rediscoverQueue.getJob(jobId)
    if (!job) {
      res.status(404).json({ error: "Job not found" })
      return
    }

    const state = await job.getState()

    res.json({
      state,
      result: job.returnvalue ?? null
    })
  }

  static async cancelRediscover(req: Request, res: Response) {
    const { jobId } = req.params
    console.log("JOB ID: ", jobId)
    const job = await rediscoverQueue.getJob(jobId as string)
    console.log("JOBBBBB: ", job)
    if (!job) {
      res.status(404).json({ error: "Job not found." })
      return
    }

    await redis.set(`rediscover:cancel:${jobId}`, "1", "EX", 60 * 60 * 24 * 10)
    // salvando cancel para a fila progredir para o proximo. deletar o job {jobId}
    // se não ter como salvar a data que a musica foi escutada e cruzar dados para otimização, pular paginas
    // onde já tem dados salvos
    res.json({ status: `Job ${jobId} marcado como cancelado.` })
  }

  // se for interrompido a requisicao no meio do job post queue mudar para rediscover:cancel e deletar job
  static async deleteRediscover(req: Request, res: Response) {
    const { jobId } = req.params

    console.log("vou apagar o job de jobid ", jobId)

    const job = await rediscoverQueue.getJob(jobId as string)
    console.log("STATE ", await job?.getState())
    if (job) {

      await redis.set(`rediscover:delete:${jobId}`, "1", "EX", 3600)

      const state = await job.getState()

      if (state !== "active") {
        await job.remove()
      }

      res.status(200).json({
        status: `Job ${jobId} deleted and marked as cancelled`
      })
      return
    }


    res.status(404).json({
      error: `Job ${jobId} not deleted because was not founded.`
    })

  }

  static async countJobs(req: Request, res: Response) {

    const jobsWaiting = await rediscoverQueue.getJobs(["wait"], 0, -1)
    const jobsActive = await rediscoverQueue.getJobs(["active"], 0, -1)
    res.status(200).json({
      jobsWaiting: jobsWaiting.length,
      jobsActive: jobsActive.length
    })
  }
}