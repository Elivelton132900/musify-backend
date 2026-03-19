import { Job } from 'bullmq';
import { RediscoverLovedTracksQuery } from '../models/last-fm.model';
import { rediscoverQueue } from './../queues/rediscoverLovedTracks.queue';
import { Request, Response, NextFunction } from "express";

const isJsonEqual = (urlQuerys: RediscoverLovedTracksQuery, jobJson: RediscoverLovedTracksQuery): boolean => {
    const urlQueryStringValues = JSON.parse(
        JSON.stringify(urlQuerys, (key, value) => {
            if (value === null || value === undefined) return value

            if (typeof value !== "object") {
                return String(value)
            }

            return value
        })
    )

    const jobJsonStringValues = JSON.parse(JSON.stringify(jobJson, (key, value) => {
        if (value === null || value === undefined) return value

        if (typeof value !== "object") {
            return String(value)
        }

        return value
    }))
    return JSON.stringify(urlQueryStringValues, Object.keys(urlQueryStringValues).sort()) ===
        JSON.stringify(jobJsonStringValues, Object.keys(jobJsonStringValues).sort())
}

const jobAlreadyRunningOrcompleted = (jobs: Job[], urlQuerys: RediscoverLovedTracksQuery): boolean => {

    for (let i = 0; i < jobs.length; i++) {
        if (isJsonEqual(urlQuerys, jobs[i].data.params)) {
            return true
        }
    }
    return false
}

export async function jobWithSameUrlExists(req: Request, res: Response, next: NextFunction) {
    try {

        const urlQuerys = req.query as unknown as RediscoverLovedTracksQuery
        const jobsActiveAndCompleted = await rediscoverQueue.getJobs(["active", "completed"], 0, -1)

        const sameUrl = jobAlreadyRunningOrcompleted(jobsActiveAndCompleted, urlQuerys)

        if (sameUrl) {
            return res.status(409).json({
                error: "Already exists a job with the same parameters"
            })
        }

        next()
    } catch(e: unknown) {

        if (e instanceof Error) {
            return next(e)
        }

        return next(new Error("Unknown Error"))
    }
}