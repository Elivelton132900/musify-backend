import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from "express";
import { rediscoverSpotifyQueue } from "../queues/rediscoverSpotify.queue";
import { PossibleRanges, TimeRange } from "../models/spotify.model";
import { SpotifyJWTPayload } from '../models/spotify.auth.model';


type TimeRangeValue = `${TimeRange}`

interface JobData {
    access_token: string,
    spotifyId: string,
    compare: {
        firstCompare: TimeRangeValue,
        secondCompare: TimeRangeValue
    }
}

type UserRanges = {
    [key: string]: keyof typeof PossibleRanges
}

type UserFilteredItem = {
    user: {
        [key: string]: {
            firstCompare: string
            secondCompare: string
        }
    }
}

export const jobWithSameUrlExists = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.cookies.spotify_token

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SpotifyJWTPayload

        const { userId } = decoded

        const allJobs = await rediscoverSpotifyQueue.getJobs(["active", "completed", "waiting"], 0, -1)

        if (allJobs.length > 0) {
            const jobsData: JobData[] = allJobs.map(a => a.data)
            const rangeToCompare = req.body.range

            const rangesInJobsData = jobsData.map(job => {
                return [
                    {
                        user: {
                            [job.spotifyId]: job.compare
                        }
                    }
                ]
            })

            const userFiltered = rangesInJobsData.map((item) => {
                return item.filter((user) => {
                    const userJob = Object.keys(user.user)
                    const userJobString = userJob[0]

                    return userJobString === userId
                })
            }).filter((array) => array.length > 0)

            const uniqueRangeValues = new Map<string, UserFilteredItem[]>()

            for (const item of userFiltered) {
                const key = JSON.stringify(item)

                if (!uniqueRangeValues.has(key)) {
                    uniqueRangeValues.set(key, item)
                }
            }

            const uniqueRangeValuesArray = Array.from(uniqueRangeValues.values())


            const rangesByUser = Object.values(uniqueRangeValuesArray)
                .flat()
                .map((user) => {
                    const userId = Object.keys(user.user)
                    const userIdString = userId[0]
                    if (typeof userIdString !== "string") {
                        throw new Error("Invalid user id")
                    }
                    
                    return {
                        [userIdString]: [
                            user.user[userIdString].firstCompare.replace("_term", ""),
                            user.user[userIdString].secondCompare.replace("_term", "")
                        ]

                    }
                })

            const rangesByUserFormatted: UserRanges[] = []

            // type predicate
            function isValidRange(value: string): value is keyof typeof PossibleRanges {
                return ["long_short", "long_medium", "medium_short", "loved"].includes(value)
            }

            for (let i = 0; i < rangesByUser.length; i++) {

                const user = Object.keys(rangesByUser[i])[0]

                const firstRangeToCompare = rangesByUser[i][user][0]
                const secondRangeToCompare = rangesByUser[i][user][1]

                const rangeFormmated = firstRangeToCompare + "_" + secondRangeToCompare

                if (isValidRange(rangeFormmated)) {
                    rangesByUserFormatted.push({ [user]: rangeFormmated })
                }

            }

            for (let i = 0; i < rangesByUserFormatted.length; i++) {

                const userNameArray = Object.keys(rangesByUserFormatted[i])
                const userNameString = userNameArray[0]

                const rangeArray = Object.values(rangesByUserFormatted[i])
                const rangeString = rangeArray[0]

                if (userNameString === userId && rangeString === rangeToCompare) {
                    return res.status(409).json({
                        error: "Already exists a job with the same parameters"
                    })
                }

            }
        }

        next()

    } catch (e: unknown) {
        if (e instanceof Error) {
            return next(e)
        }

        return next(new Error("Unknown Error"))
    }
}