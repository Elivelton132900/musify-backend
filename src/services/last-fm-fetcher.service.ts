import { Params, TrackDataLastFm, trackRecentData, RecentTracks, TrackWithPlaycount, topTracksAllTime } from './../models/last-fm.model';
import { AxiosError } from "axios"
import dayjs, { } from "dayjs"
import utc from "dayjs/plugin/utc"
import { lastFmMapper } from "../utils/lastFmMapper"
import { calculateWindowValueToFetch, createURL, deleteDuplicate, getTotalBlocks, getTracksByAccountPercentage, normalize } from "../utils/lastFmUtils"
import { LastFmFullProfile } from "../models/last-fm.auth.model"
import { LastFmRepository } from '../repositories/last-fm.repository';
import pLimit from 'p-limit';
import { safeAxiosGet } from '../utils/lastFmUtils';

export class LastFmFetcherService {

    private readonly endpoint = "https://ws.audioscrobbler.com/2.0/"
    private readonly lastFmRepository: LastFmRepository
    private shouldRun: boolean
    private shouldRunPromiseAll: boolean
    private fetchInDays: number

    constructor(
        private readonly mapper = lastFmMapper,
    ) {
        this.lastFmRepository = new LastFmRepository()
        this.shouldRun = true
        this.shouldRunPromiseAll = true
        this.fetchInDays = 120
    }

    async loopFetchApi(
        limit: number,
        user: string | LastFmFullProfile,
        page: number,
        from?: number,
        to?: number,
        endpoint?: string
    ): Promise<RecentTracks[]> {

        this.shouldRun = true

        let response: RecentTracks | null = null
        const allResponses: RecentTracks[] = []

        const fetchWithRetry = async (params: Params, endpoint?: string) => {
            if (!endpoint) {
                response = await safeAxiosGet<RecentTracks>(this.endpoint, params);
                return !response ? null : response
            } else {
                response = await safeAxiosGet<RecentTracks>(endpoint)
                return !response ? null : response
            }
        }


        while (this.shouldRun) {

            await new Promise(resolve => setTimeout(resolve, 1000))
            if (!this.shouldRun) break;


            try {
                let responseTracks = await fetchWithRetry({
                    method: "user.getrecenttracks",
                    limit,
                    user: typeof user === "string" ? user : user.name,
                    from,
                    to,
                    api_key: process.env.LAST_FM_API_KEY,
                    page,
                    format: "json"
                }
                )

                if (responseTracks) {
                    allResponses.push(responseTracks)
                }

                await new Promise(resolve => setTimeout(resolve, 1000))
                if (responseTracks) {
                    if (responseTracks.recenttracks.track.length >= 1) {
                        this.shouldRun = false
                    }
                }

            } catch (error: unknown) {
                if (error instanceof AxiosError) {
                    const status = error.status
                    const message = error.message
                    console.log(status, message, "MIDDLEWARE")
                }
            }

        }
        this.shouldRun = false
        return allResponses

    }


    async getTracksByPercentage(
        percentageToCompare: number,
        user: LastFmFullProfile | string,
        limit: number = 200,
        offset: number,
        page: number = 1,
        windowValueToFetch: number = 200,
        from: number,
        to: number,

    ) {



        let creationAccountUnixDate: number

        if (typeof user === "string") {
            creationAccountUnixDate = Number(await this.lastFmRepository.getCreationUnixtime(user))
        } else {
            creationAccountUnixDate = Number(user.registered.unixtime)
        }
        const { fromDate, toDate } = getTracksByAccountPercentage(
            creationAccountUnixDate,
            percentageToCompare,
            windowValueToFetch as number,
            offset
        )

        if (dayjs.unix(Number(toDate)).utc().isAfter(dayjs(), "day") || dayjs.unix(Number(fromDate)).utc().isAfter(dayjs(), "day")) {
            return []
        }

        dayjs.extend(utc)
        let responseTracks: RecentTracks[] = []

        responseTracks.push(...await this.loopFetchApi(limit, user, page, from, to))



        const tracksRaw = responseTracks

        if (!tracksRaw || tracksRaw.length === 0) {
            console.warn("[LastFmService] Nenhuma track encontrada}")
            return [];
        }

        const tracksArray = Array.isArray(tracksRaw) ? tracksRaw : [tracksRaw];

        const allTracks = tracksArray.flatMap(t => t.recenttracks.track)
        const allTracksArray = Array.isArray(allTracks)
            ? allTracks
            : [allTracks]
        const addedPlaycount = await Promise.all(
            allTracksArray.map(async (track) => {

                const playcountResponse = await this.getPlaycountOfTrack(
                    user,
                    track.name,
                    track.artist['#text']
                )

                return {
                    ...track,
                    date: track.date,
                    userplaycount: Number(playcountResponse),
                }
            })
        )

        return this.mapper.toRecentAndOldTracksData([{ recenttracks: { track: addedPlaycount } }])
    }

    async getTopOldTracksPercentage(
        user: LastFmFullProfile | string,
        percentage: number,
        limit: number,
        from?: number,
        to?: number
    ) {

        const offset = 0

        const username = typeof user === "string" ? user : user.name

        const totalScrobbles: number = await this.lastFmRepository.getTotalScrobbles(username)

        const windowValueToFetch = calculateWindowValueToFetch(totalScrobbles)
        const creationAccountUnixDate = Number(await this.lastFmRepository.getCreationUnixtime(username))

        const { fromDate, toDate } = getTracksByAccountPercentage(
            creationAccountUnixDate,
            percentage,
            windowValueToFetch,
            offset
        )


        const page = 1

        const oldTracks = await this.getTracksByPercentage(
            percentage,
            user,
            limit,
            offset,
            page,
            windowValueToFetch,
            from = fromDate,
            to = toDate
        )
        return oldTracks
    }

    async getTopRecentTrack(user: LastFmFullProfile | string, percentage: number, limit: number, from: number, to: number) {

        const offset = 0
        const windowValueToFetch = 200
        const page = 1

        const recentTracks = await this.getTracksByPercentage(
            percentage,
            user,
            limit,
            offset,
            page,
            windowValueToFetch,
            from,
            to
        )
        return recentTracks

    }

    async getTopTracksAllTime(username: string, limit: string) {

        const params = {
            method: "user.gettoptracks",
            format: "json",
            user: username,
            period: "overall",
            limit,
            api_key: process.env.LAST_FM_API_KEY
        }

        const response = await safeAxiosGet(this.endpoint, params) as topTracksAllTime

        return response
    }


    async getPlaycountOfTrack(user: LastFmFullProfile | string, musicName: string, artistName: string) {

        const params = {
            method: "track.getInfo",
            user: typeof user === "string" ? user : user.name,
            track: musicName,
            artist: artistName,
            format: "json",
            api_key: process.env.LAST_FM_API_KEY,
            limit: 0
        }

        const response = await safeAxiosGet<TrackWithPlaycount>(this.endpoint, params)

        const userPlaycount = response?.track.userplaycount ?? "0";
        return userPlaycount
    }

    async tracksWithinPercentage(
        userLastFm: string,
        limit: number,
        startOfDay: number,
        endOfDay: number,
        endpointEachDay?: string[],
    ) {
        let topOldTracksRaw: trackRecentData[] = []
        let topOldTracks: TrackDataLastFm[] = []

        if (!endpointEachDay) {
            endpointEachDay = createURL(
                true,
                "user.getrecenttracks",
                limit,
                userLastFm,
                startOfDay,
                endOfDay,
                process.env.LAST_FM_API_KEY as string,
                "1",
                "json",
            )
        }


        const limitConcurrency = pLimit(10)

        await Promise.all(
            endpointEachDay.map(endpoint => limitConcurrency(async () => {

                const response = await safeAxiosGet<RecentTracks>(endpoint)
                if (!response) return

                const tracks = Array.isArray(response.recenttracks.track)
                    ? response.recenttracks.track
                    : [response.recenttracks.track]

                topOldTracksRaw.push(...tracks)
            }))
        )


        // Mapeia tudo de uma vez
        topOldTracks = this.mapper.toRecentAndOldTracksData([
            { recenttracks: { track: topOldTracksRaw } }
        ])

        // Remove duplicados
        topOldTracks = deleteDuplicate(topOldTracks)

        // Filtra pelo percentageToCompare
        return topOldTracks
    }
    // async fetchUntilPercentage(
    //     userlastfm: string,
    //     percentage: number,
    //     limit: number,
    //     fromDate: dayjs.Dayjs,
    //     toDate: dayjs.Dayjs,
    //     oldTracks: TrackDataLastFm[]
    // ) {

    //     let numberTracksFetched = 0
    //     let countLoop = 0

    //     let decrementedStartOfDay = fromDate
    //     let decrementedEndOfDay = toDate

    //     if (oldTracks.length > 0) {

    //         while (numberTracksFetched < limit) {
    //             decrementedStartOfDay = fromDate.subtract(1, "day").startOf("day")
    //             decrementedEndOfDay = toDate.subtract(1, "day").endOf("day")
    //             //let oldTracks = await this.getTopRecentTrack(userlastfm, percentage, 200, decrementedStartOfDay, decrementedEndOfDay)
    //             numberTracksFetched = oldTracks.length
    //             countLoop += 1

    //             if (countLoop >= 180) {
    //                 oldTracks = oldTracks.map((t) => ({
    //                     ...t,
    //                     date: {
    //                         uts: "?",
    //                         "#text": "not listened to for more than 6 months"
    //                     }
    //                 }))
    //                 break
    //             }
    //         }
    //         return oldTracks

    //     }
    //     return oldTracks
    // }

    async getLastTimeMusicListened(tracks: TrackDataLastFm[], userLastFm: string, percentageToCompare: number, endpointsEachDay?: string[]) {
        //const percentage = 0
        const limit = 20
        //let offset = 0

        const initialStartOfDay = dayjs().utc().startOf("day")
        const finalEndOfDay = dayjs().utc().endOf("day")

        //const finalDate = dayjs().utc().subtract(180, "day")

        const endpointEachDay = createURL(
            false,
            "user.getrecenttracks",
            limit,
            userLastFm,
            initialStartOfDay.unix(),
            finalEndOfDay.unix(),
            process.env.LAST_FM_API_KEY as string,
            "1",
            "json",
        )


        const limitConcurrency = pLimit(10)
        const listenedTracksMap = new Map<string, trackRecentData>()

        const uniqueKeysTracks = tracks.map((t) => normalize(t.name, t.artist))
        this.shouldRunPromiseAll = true
        await Promise.all(
            endpointEachDay.map(endpoint => limitConcurrency(async () => {

                if (tracks.length === listenedTracksMap.size) {

                    this.shouldRunPromiseAll = false
                    return listenedTracksMap
                }

                if (!this.shouldRunPromiseAll) {
                    return listenedTracksMap
                }

                const response = (await safeAxiosGet<RecentTracks>(endpoint))
                if (!response) {
                    return []
                }

                // avoiding error .map is not a function when the endpoint returns just an object
                const tracksArray = Array.isArray(response.recenttracks.track)
                    ? response.recenttracks.track
                    : [response.recenttracks.track]

                tracksArray.map((t) => {
                    const key = normalize(t.name, t.artist['#text'])
                    const filtered = uniqueKeysTracks.filter((u) => {
                        return key === u
                    })
                    filtered.map((k) => {
                        const existing = listenedTracksMap.get(k)
                        if (!existing) {
                            listenedTracksMap.set(k, t)
                            return
                        }

                        const existingUts = Number(existing.date?.uts ?? 0);
                        const newUts = Number(t.date?.uts ?? 0);

                        if (newUts > existingUts) {
                            listenedTracksMap.set(k, t);
                        }

                    })
                })
                return listenedTracksMap
            }))
        )

        const mappedTracks = this.mapper.toRecentAndOldTracksData([{
            recenttracks: {
                track: tracks
                    .map((t) => listenedTracksMap.get(normalize(t.name, t.artist))!)
            }
        }])

        // const mappedTracksWithPlaycount = await Promise.all(
        //     mappedTracks.map(async (t) => {
        //         const playcount = await this.getPlaycountOfTrack(userLastFm, t.name, t.artist)
        //         console.log(playcount, t.name, t.artist)
        //         return { ...t, userplaycount: playcount }
        //     })
        // )

        // if music dont appears in 3 months
        let allTracks = tracks.filter((t) => {
            return !mappedTracks.some(k => (normalize(k.name, k.artist) === normalize(t.name, t.artist)))
        })

        allTracks = await Promise.all(
            allTracks.map(async (t) => {
                const playcount = await this.getPlaycountOfTrack(userLastFm, t.name, t.artist)
                return { ...t, userplaycount: playcount }
            })
        )

        allTracks = allTracks.filter((t) => {
            return Number(t.userplaycount) >= percentageToCompare && Number(t.userplaycount) <= percentageToCompare + 150
        })

        allTracks = allTracks.map((t) => ({
            ...t,
            date: { uts: "0", "#text": `not listened in ${this.fetchInDays} days` }
        }))


        return allTracks
    }


    async rediscoverLovedTracks(userlastfm: string, limit: string, percentage: number) {
        const topTrack: topTracksAllTime = await this.getTopTracksAllTime(userlastfm, "1")

        const trackName = topTrack.toptracks.track[0].name
        const artistName = topTrack.toptracks.track[0].artist.name
        const scrobbleQuantityTopMusic = await this.getPlaycountOfTrack(userlastfm, trackName, artistName)

        let countLoop = 0
        let offset = 0

        let executed = false

        const windowValueToFetch = 200

        const creationAccountUnixDate = Number(await this.lastFmRepository.getCreationUnixtime(userlastfm))

        let mostPlayedCount = {
            data: {
                toptracks: {
                    track: [topTrack.toptracks.track[0]]
                },
                userplaycount: scrobbleQuantityTopMusic
            }
        }.data.userplaycount

        const limitt = 20
        const percentageToCompare = Math.ceil((Number(mostPlayedCount) * 2) / 100)

        let lastTimeListened: TrackDataLastFm[] = []
        let lastTimeListenedLoop: TrackDataLastFm[] = []

        const totalBlocks = getTotalBlocks(creationAccountUnixDate, windowValueToFetch)

        let endpoints: string[] = []
        let oldTracksWithinPercentageLoop: TrackDataLastFm[] = []


        while (lastTimeListened.length < limitt) {
            const { fromDate, toDate } = getTracksByAccountPercentage(
                creationAccountUnixDate,
                percentage,
                windowValueToFetch,
                offset
            );

            endpoints = createURL(
                true,
                "user.getrecenttracks",
                totalBlocks,
                userlastfm,
                fromDate,
                toDate,
                process.env.LAST_FM_API_KEY!,
                "1",
                "json",
                true,
                creationAccountUnixDate,
                percentage,
                windowValueToFetch,
                offset
            );

            oldTracksWithinPercentageLoop = await this.tracksWithinPercentage(userlastfm, limitt, fromDate, toDate, endpoints)

            if (!executed) {
                lastTimeListenedLoop = await this.getLastTimeMusicListened(oldTracksWithinPercentageLoop, userlastfm, percentageToCompare)
                executed = true
            }

            if (offset >= totalBlocks) {
                break
            }



            if (lastTimeListened.length >= limitt) {
                break
            }

            lastTimeListened = deleteDuplicate([
                ...lastTimeListened,
                ...lastTimeListenedLoop
            ])
            offset += 1
            countLoop += 1

        }





        // return lastTimeListened

        //if music not appears in 3 month
        return lastTimeListened
    }
}