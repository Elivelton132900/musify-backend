
import { Params, TrackDataLastFm, trackRecentData, RecentTracks, TrackWithPlaycount, topTracksAllTime } from './../models/last-fm.model';
import { AxiosError } from "axios"
import dayjs, { } from "dayjs"
import utc from "dayjs/plugin/utc"
import { lastFmMapper } from "../utils/lastFmMapper"
import { calculateWindowValueToFetch, createURL, deleteDuplicateKeepLatest, deleteTracksNotInRange, deleteTracksUserPlaycount, distinctArtists, getTotalBlocks, getTracksByAccountPercentage, normalize } from "../utils/lastFmUtils"
import { LastFmFullProfile } from "../models/last-fm.auth.model"
import { LastFmRepository } from '../repositories/last-fm.repository';
import pLimit from 'p-limit';
import { safeAxiosGet } from '../utils/lastFmUtils';

export class LastFmFetcherService {

    private readonly endpoint = "https://ws.audioscrobbler.com/2.0/"
    private readonly lastFmRepository: LastFmRepository
    private shouldRun: boolean
    private fetchInDays: number
    private quantityOfTracksFetched: number
    private runLastTimeListened: boolean
    private timeLoopHasRun: number

    constructor(
        private readonly mapper = lastFmMapper,
    ) {
        this.lastFmRepository = new LastFmRepository()
        this.shouldRun = true
        this.fetchInDays = 10
        this.quantityOfTracksFetched = 0
        this.runLastTimeListened = true
        this.timeLoopHasRun = 0
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

                if (!responseTracks || responseTracks.recenttracks.track.length === 0) {
                    this.shouldRun = false
                    break
                }

                allResponses.push(responseTracks)


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
        windowValueToFetch: number = 198,
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
                    track?.artist['#text']
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
        const windowValueToFetch = 198
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

        const userPlaycount = response?.track?.userplaycount ?? "0";
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

        const limitConcurrency = pLimit(15)

        await Promise.all(
            endpointEachDay.map(endpoint => limitConcurrency(async () => {
                const response = await safeAxiosGet<RecentTracks>(endpoint)

                if (!response) {
                    return
                }

                const tracks = Array.isArray(response.recenttracks.track)
                    ? response.recenttracks.track
                    : [response.recenttracks.track]

                topOldTracksRaw.push(...tracks.map(t => ({ ...t })));

            }))
        )


        // Mapeia tudo de uma vez
        topOldTracks = this.mapper.toRecentAndOldTracksData([
            { recenttracks: { track: topOldTracksRaw } }
        ])

        // Remove duplicados
        topOldTracks = deleteDuplicateKeepLatest(topOldTracks)

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



    async getLastTimeMusicListened(
        baseTracks: TrackDataLastFm[],
        userLastFm: string,
        percentageToCompare: number,
        fetchInDays: number,
        maximumScrobbles: number | boolean
    ) {

        //  1. Cálculo do intervalo de dias a buscar

        let start = dayjs().utc().startOf("day")
        let end = dayjs().utc().endOf("day")

        // 2. criar todos os endpoints do intervalo
        const endpoints = createURL(
            false,
            "user.getrecenttracks",
            fetchInDays,
            userLastFm,
            start.unix(),
            end.unix(),
            process.env.LAST_FM_API_KEY!,
            "1",
            "json"
        )

        // 3. dividir em chunks para não explodir em requisições

        const chunkSize = 10
        const chunked: string[][] = []


        for (let i = 0; i <= endpoints.length; i += chunkSize) {
            chunked.push(endpoints.slice(i, i + chunkSize))
        }

        // 4. buscar por todas as tracks recentes
        const limitConcurrency = pLimit(15)
        const allRecentTracks: trackRecentData[] = []
        const batchResults: trackRecentData[] = []
        let countError = 0
        const promises = endpoints.map(endpoint =>

            limitConcurrency(async () => {
                const response = await safeAxiosGet<RecentTracks>(endpoint)

                if (!response) {
                    countError += 1
                    return
                }

                if (countError >= 10) {
                    console.log("count error: ", countError)
                    throw new Error("Too many failed requests, try again later")
                }

                const tracks = Array.isArray(response.recenttracks.track)
                    ? response.recenttracks.track
                    : [response.recenttracks.track]

                batchResults.push(...tracks)
            })
        )


        await Promise.all(promises)
        allRecentTracks.push(...batchResults)


        // 5. criar conjunto de chaves únicas das topp tracks

        const uniqueKeys = new Set(
            baseTracks.map(t =>
                normalize(
                    t.name,
                    typeof t.artist === "string" ? t.artist : t?.artist["#text"]
                )
            )
        )


        // 6. Normaliza cada track (antes de agrupar)
        const normalized = allRecentTracks.map(t => ({
            ...t,
            key: normalize(
                t.name ?? "",
                (typeof t.artist === "string" ? t.artist : t?.artist["#text"]) ?? ""
            )
        })) as (trackRecentData & { key: string })[]


        // 7. agrupa por chave normalizada

        const grouped = new Map<string, trackRecentData[]>()

        for (const track of normalized) {


            if (!uniqueKeys.has(track.key)) {
                continue
            }

            if (!grouped.has(track.key)) {
                grouped.set(track.key, [])
            }

            grouped.get(track.key)!.push(track)
        }

        // 8. para cada chave, descobre a track mais recente

        const latestTracks = new Map<string, trackRecentData>()


        for (const [key, tracks] of grouped.entries()) {

            let daysWithoutListening = this.fetchInDays

            if (this.timeLoopHasRun != 0) {
                daysWithoutListening += this.fetchInDays
            }

            const valid = tracks.filter(x => x.date?.uts && !isNaN(Number(x.date?.uts)))
            if (valid.length === 0) continue


            const greatest = Math.max(...valid.map((t) => Number(t.date.uts)))

            const latest = valid.find(t => Number(t.date.uts) === greatest)

            if (latest) latestTracks.set(key, latest)
        }

        // ------------------------------------

        // 9. convertre para trackdatalastfm[] usando mapper

        const mapped = this.mapper.toRecentAndOldTracksData([
            { recenttracks: { track: Array.from(latestTracks.values()) } }
        ])


        this.quantityOfTracksFetched = latestTracks.size;
        // 10. buscar playcount real de cada musica

        const results = await Promise.all(
            mapped.map(t =>
                limitConcurrency(async () => {
                    const count = await this.getPlaycountOfTrack(userLastFm, t.name, t.artist)
                    return { ...t, userplaycount: count }
                })
            )
        )
        // 11. aplicar o filtro por percentual

        let filtered: TrackDataLastFm[] = []


        if (typeof maximumScrobbles === 'number') {
            filtered = results.filter(t =>
                Number(t.userplaycount) >= percentageToCompare && Number(t.userplaycount) < maximumScrobbles
            ) as TrackDataLastFm[]
        } else {
            filtered = results.filter(t =>
                Number(t.userplaycount) >= percentageToCompare
            ) as TrackDataLastFm[]
        }

        return filtered.map(t => {
            if (!(t.date['#text'].includes("than"))) {
                return {
                    ...t,
                    date: {
                        uts: t.date?.uts,
                        "#text": `not listened in more than ${dayjs().diff(dayjs.unix(Number(t.date?.uts)), "days")} days`
                    }
                }
            } else return t

        })


    }

    // async getLastTimeMusicListened(
    //     baseTracks: TrackDataLastFm[],
    //     userLastFm: string,
    //     percentageToCompare: number,
    //     fetchInDays: number,
    //     maximumScrobbles: number | boolean
    // ) {

    //     //  1. Cálculo do intervalo de dias a buscar

    //     let start = dayjs().utc().startOf("day")
    //     let end = dayjs().utc().endOf("day")

    //     // 2. criar todos os endpoints do intervalo
    //     const endpoints = createURL(
    //         false,
    //         "user.getrecenttracks",
    //         fetchInDays,
    //         userLastFm,
    //         start.unix(),
    //         end.unix(),
    //         process.env.LAST_FM_API_KEY!,
    //         "1",
    //         "json"
    //     )

    //     // 3. dividir em chunks para não explodir em requisições

    //     const chunkSize = 10
    //     const chunked: string[][] = []


    //     for (let i = 0; i <= endpoints.length; i += chunkSize) {
    //         chunked.push(endpoints.slice(i, i + chunkSize))
    //     }

    //     // 4. buscar por todas as tracks recentes
    //     const limitConcurrency = pLimit(15)
    //     const allRecentTracks: trackRecentData[] = []
    //     const batchResults: trackRecentData[] = []
    //     let countError = 0
    //     const promises = endpoints.map(endpoint =>

    //         limitConcurrency(async () => {
    //             const response = await safeAxiosGet<RecentTracks>(endpoint)

    //             if (!response) {
    //                 countError += 1
    //                 return
    //             }

    //             if (countError >= 10) {
    //                 console.log("count error: ", countError)
    //                 throw new Error("Too many failed requests, try again later")
    //             }

    //             const tracks = Array.isArray(response.recenttracks.track)
    //                 ? response.recenttracks.track
    //                 : [response.recenttracks.track]

    //             batchResults.push(...tracks)
    //         })
    //     )


    //     await Promise.all(promises)
    //     allRecentTracks.push(...batchResults)


    //     // 5. criar conjunto de chaves únicas das topp tracks

    //     const uniqueKeys = new Set(
    //         baseTracks.map(t =>
    //             normalize(
    //                 t.name,
    //                 typeof t.artist === "string" ? t.artist : t?.artist["#text"]
    //             )
    //         )
    //     )


    //     // 6. Normaliza cada track (antes de agrupar)
    //     const normalized = allRecentTracks.map(t => ({
    //         ...t,
    //         key: normalize(
    //             t.name ?? "",
    //             (typeof t.artist === "string" ? t.artist : t?.artist["#text"]) ?? ""
    //         )
    //     })) as (trackRecentData & { key: string })[]


    //     // 7. agrupa por chave normalizada

    //     const grouped = new Map<string, trackRecentData[]>()

    //     for (const track of normalized) {


    //         if (!uniqueKeys.has(track.key)) {
    //             continue
    //         }

    //         if (!grouped.has(track.key)) {
    //             grouped.set(track.key, [])
    //         }

    //         grouped.get(track.key)!.push(track)
    //     }

    //     // 8. para cada chave, descobre a track mais recente

    //     const latestTracks = new Map<string, trackRecentData>()


    //     for (const [key, tracks] of grouped.entries()) {

    //         let daysWithoutListening = this.fetchInDays

    //         if (this.timeLoopHasRun != 0) {
    //             daysWithoutListening += this.fetchInDays
    //         }

    //         const valid = tracks.filter(x => x.date?.uts && !isNaN(Number(x.date?.uts)))
    //         if (valid.length === 0) continue


    //         const greatest = Math.max(...valid.map((t) => Number(t.date.uts)))

    //         const latest = valid.find(t => Number(t.date.uts) === greatest)

    //         if (latest) latestTracks.set(key, latest)
    //     }

    //     // ------------------------------------

    //     // 9. convertre para trackdatalastfm[] usando mapper

    //     const mapped = this.mapper.toRecentAndOldTracksData([
    //         { recenttracks: { track: Array.from(latestTracks.values()) } }
    //     ])


    //     this.quantityOfTracksFetched = latestTracks.size;
    //     // 10. buscar playcount real de cada musica

    //     const results = await Promise.all(
    //         mapped.map(t =>
    //             limitConcurrency(async () => {
    //                 const count = await this.getPlaycountOfTrack(userLastFm, t.name, t.artist)
    //                 return { ...t, userplaycount: count }
    //             })
    //         )
    //     )
    //     // 11. aplicar o filtro por percentual

    //     let filtered: TrackDataLastFm[] = []


    //     if (typeof maximumScrobbles === 'number') {
    //         filtered = results.filter(t =>
    //             Number(t.userplaycount) >= percentageToCompare && Number(t.userplaycount) < maximumScrobbles
    //         ) as TrackDataLastFm[]
    //     } else {
    //         filtered = results.filter(t => 
    //             Number(t.userplaycount) >= percentageToCompare
    //         ) as TrackDataLastFm[]
    //     }

    //     return filtered.map(t => {
    //         if (!(t.date['#text'].includes("than"))) {
    //             return {
    //                 ...t,
    //                 date: {
    //                     uts: t.date?.uts,
    //                     "#text": `not listened in more than ${dayjs().diff(dayjs.unix(Number(t.date?.uts)), "days")} days`
    //                 }
    //             }
    //         } else return t

    //     })


    // }

    async rediscoverLovedTracks(
        userlastfm: string,
        limit: number,
        percentage: number,
        fetchInDays: number,
        fetchForDistinct: number | boolean,
        maximumScrobbles: number | boolean
    ) {

        this.fetchInDays = fetchInDays

        const topTrack: topTracksAllTime = await this.getTopTracksAllTime(userlastfm, "1")

        const trackName = topTrack.toptracks.track[0].name
        const artistName = topTrack.toptracks.track[0].artist.name
        const scrobbleQuantityTopMusic = await this.getPlaycountOfTrack(userlastfm, trackName, artistName)

        let countLoop = 0
        let offset = 0

        let windowValueToFetch = 199

        const creationAccountUnixDate = Number(await this.lastFmRepository.getCreationUnixtime(userlastfm))

        let mostPlayedCount = {
            data: {
                toptracks: {
                    track: [topTrack.toptracks.track[0]]
                },
                userplaycount: scrobbleQuantityTopMusic
            }
        }.data.userplaycount

        if (typeof maximumScrobbles === 'number') {
            maximumScrobbles = Math.min(Number(mostPlayedCount), maximumScrobbles)
        }


        const percentageToCompareTopMusic = Math.ceil((Number(mostPlayedCount) * 2) / 100)
        let lastTimeListened: TrackDataLastFm[] = []
        let lastTimeListenedLoop: TrackDataLastFm[] = []

        let totalBlocks = getTotalBlocks(creationAccountUnixDate, windowValueToFetch)

        let endpoints: string[] = []
        let oldTracksWithinPercentageLoop: TrackDataLastFm[] = []
        const containOldTracks: TrackDataLastFm[] = []


        while (this.quantityOfTracksFetched < Number(limit)) {

            this.timeLoopHasRun += 1

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

            oldTracksWithinPercentageLoop = await this.tracksWithinPercentage(userlastfm, Number(limit), fromDate, toDate, endpoints)
            containOldTracks.push(...oldTracksWithinPercentageLoop)
            if (offset >= totalBlocks) {
                totalBlocks = getTotalBlocks(creationAccountUnixDate, windowValueToFetch)
            }

            if (this.runLastTimeListened) {
                lastTimeListenedLoop = await this.getLastTimeMusicListened(containOldTracks, userlastfm, percentageToCompareTopMusic, this.fetchInDays, maximumScrobbles) as TrackDataLastFm[]
                lastTimeListenedLoop = deleteDuplicateKeepLatest(lastTimeListenedLoop)

                this.quantityOfTracksFetched = lastTimeListenedLoop.length
                this.runLastTimeListened = false

            }

            if (this.runLastTimeListened === false && this.quantityOfTracksFetched < Number(limit)) {

                lastTimeListenedLoop = await this.getLastTimeMusicListened(containOldTracks, userlastfm, percentageToCompareTopMusic, this.fetchInDays, maximumScrobbles) as TrackDataLastFm[]
                lastTimeListenedLoop = deleteDuplicateKeepLatest(lastTimeListenedLoop)
                console.log("entrei aqui 2", lastTimeListened.length)
                this.quantityOfTracksFetched = lastTimeListenedLoop.length
            }


            lastTimeListened.push(...lastTimeListenedLoop)

            // const merged = [...lastTimeListened, ...(Array.isArray(lastTimeListenedLoop) ? lastTimeListenedLoop : [lastTimeListenedLoop])]
            // lastTimeListened = deleteDuplicateKeepLatest(merged)
            // OUTROS FILTROS IRIAM VIR AQUI ABAIXO
            lastTimeListened = deleteDuplicateKeepLatest(lastTimeListened)
            lastTimeListened = deleteTracksNotInRange(this.fetchInDays, lastTimeListened, containOldTracks)

            const limitConcurrency = pLimit(15)
            lastTimeListened = await Promise.all(
                lastTimeListened.map(track => limitConcurrency(async () => {
                    const trackName = track.name
                    const artistName = track.artist
                    const UserPlaycount = await this.getPlaycountOfTrack(userlastfm, trackName, artistName)

                    return {
                        ...track,
                        userplaycount: UserPlaycount
                    }
                }))
            )
            lastTimeListened = deleteTracksUserPlaycount(percentageToCompareTopMusic, lastTimeListened, maximumScrobbles)
            if (typeof fetchForDistinct === 'number') {
                lastTimeListened = distinctArtists(lastTimeListened, fetchForDistinct, 'descending')
            }
            this.quantityOfTracksFetched = lastTimeListened.length
            offset += 1
            countLoop += 1

            if (this.quantityOfTracksFetched >= Number(limit)) {
                break
            }

            if (this.timeLoopHasRun >= 30) {
                break
            }

        }


        //getPlaycountOfTrack
        // return lastTimeListened

        //if music not appears in 3 month
        return lastTimeListened.slice(0, Number(limit)).sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
    }
}