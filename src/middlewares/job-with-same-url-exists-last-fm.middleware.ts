import { Job } from "bullmq"
import { RediscoverLovedTracksBody } from "../models/last-fm.model"
import { rediscoverLastFmQueue } from "../queues/rediscoverLastfm.queue"
import { Request, Response, NextFunction } from "express"

const isJsonEqual = (
    urlBody: RediscoverLovedTracksBody,
    jobJson: RediscoverLovedTracksBody,
): boolean => {
    const urlQueryStringValues = JSON.parse(
        JSON.stringify(urlBody, (key, value) => {
            if (value === null || value === undefined) return value

            if (typeof value !== "object") {
                return String(value)
            }

            return value
        }),
    )

    const jobJsonStringValues = JSON.parse(
        JSON.stringify(jobJson, (key, value) => {
            if (value === null || value === undefined) return value

            if (typeof value !== "object") {
                return String(value)
            }

            return value
        }),
    )
    return (
        JSON.stringify(urlQueryStringValues, Object.keys(urlQueryStringValues).sort()) ===
        JSON.stringify(jobJsonStringValues, Object.keys(jobJsonStringValues).sort())
    )
}

const jobAlreadyRunningOrcompleted = (
    jobs: Job[],
    urlQuerys: RediscoverLovedTracksBody,
): boolean => {
    for (let i = 0; i < jobs.length; i++) {
        if (isJsonEqual(urlQuerys, jobs[i].data.params)) {
            return true
        }
    }
    return false
}

export async function jobWithSameUrlExists(req: Request, res: Response, next: NextFunction) {
    try {
        const urlBody = req.body as unknown as RediscoverLovedTracksBody
        const jobsActiveAndCompleted = await rediscoverLastFmQueue.getJobs(
            ["active", "completed", "waiting"],
            0,
            -1,
        )

        const sameUrl = jobAlreadyRunningOrcompleted(jobsActiveAndCompleted, urlBody)

        if (sameUrl) {
            return res.status(409).json({
                error: "Already exists a job with the same parameters",
            })
        }

        next()
    } catch (e: unknown) {
        if (e instanceof Error) {
            return next(e)
        }

        return next(new Error("Unknown error"))
    }
}
