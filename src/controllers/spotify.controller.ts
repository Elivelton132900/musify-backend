import { rediscoverSpotifyQueue } from './../queues/rediscoverSpotify.queue';
import { SpotifyCookies, SpotifyJWTPayload } from './../models/spotify.auth.model';
import { Request, Response } from "express"
import { PossibleRanges, TimeRange } from './../models/spotify.model';
import { ObjectId } from '../models/last-fm.model';
import { redis } from '../infra/redis';
import { addJobToQueue } from '../utils/spotifyUtils';

export interface SpotifyRequest extends Request {
    cookies: SpotifyCookies,
    spotifyUser?: SpotifyJWTPayload
}

export class SpotifyController {

    static async syncAndCompareTimeRange(req: SpotifyRequest, res: Response) {

        try {
            const access_token = req.spotifyUser?.access_token || ""
            const spotifyId = req.spotifyUser?.spotifyId || ""


            const comparationRange: string = req.body.range
            const timeRanges: string = PossibleRanges[comparationRange as keyof typeof PossibleRanges]
            const rangesToCompare = timeRanges.split("-")


            const firstRange = TimeRange[rangesToCompare[0] as keyof typeof TimeRange]
            const secondRange = TimeRange[rangesToCompare[1] as keyof typeof TimeRange]

            const compare = { firstCompare: firstRange, secondCompare: secondRange }

            const job = await addJobToQueue(access_token, spotifyId, compare)

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

    static async getJob(req: Request, res: Response) {
        const query = req.params as unknown as ObjectId

        const { jobId } = query
        const job = await rediscoverSpotifyQueue.getJob(jobId)

        if (!job) {
            res.status(404).json({ error: "Job not found" })
            return
        }

        const state = await job.getState()

        res.json({
            state,
            result: job.returnvalue ?? null // ?
        })
    }

    static async cancelRediscover(req: Request, res: Response) {
        const { jobId } = req.params
        const job = await rediscoverSpotifyQueue.getJob(jobId as string)

        if (!job) {
            res.status(404).json({
                error: "Job not found"
            })
            return
        }

        await redis.set(`rediscover:cancel:spotify:${jobId}`, "1", "EX", 60 * 60 * 24)

        res.json({
            status: `Job ${jobId} marked as cancelled`
        })
    }


    static async deleteRediscover(req: Request, res: Response) {
        const { jobId } = req.params

        const job = await rediscoverSpotifyQueue.getJob(jobId as string)

        if (job) {

            await redis.set(`rediscover:delete:spotify:${jobId}`, "1", "EX", 3600)

            await redis.del(`spotify:users:${job.data.spotifyId}:${job.data.compare.firstCompare}`)
            await redis.del(`spotify:users:${job.data.spotifyId}:${job.data.compare.secondCompare}`)
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
            error: `Job ${jobId} not deleted because was not founded`
        })
    }

    static async getJobs(req: Request, res: Response) {

        const jobs = await rediscoverSpotifyQueue.getJobs(["wait", "active"], 0, -1)
        res.status(200).json({
            jobs,
            timeStamp: new Date().toISOString()
        })
    }


}


