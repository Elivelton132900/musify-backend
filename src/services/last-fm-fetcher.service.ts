// TO DO: param URL com quantas musicas quer, e quantos dias sem escutar a musica.
// TO DO: PARAM URL com quantos scrobbles, >= <= a pessoa quer
// TO DO: fetchInDays no param
//            const limitConcurrency = pLimit(15) como PRIVATE
// CONSIDERAR COLOCAR QUANTAS MUSICAS DE CADA ARTISTA PODE APARECER NO RESULTADO FINAL 
// LIMIT NO CREATE URL
// TO DO: NÃO SÓ ASCENDING E DESCENDING EM DISTINCT, COLOCAR SHUFFLE TAMBÉM

//DISTINCT VALOR NUMERICO NÃO PODE SER MAIOR DO QUE LIMIT

//     for (const track of tracksFlattened) {   BREAK SE RESULTADO FINAL FOR >= LIMIT

// DENTRO DOS BLOCOS DO DISTINCT, EXEMPLO QUE RETORNOU UM BLOCO COM DISTINCT = 4, FILTRAR POR ASCENDING OU DESCENDING DENTRO DO BLOCO POR USER PLAY COUNT
// DISTINCT: ALÉM DE ASCENDING E DESCENDING, SHUFFLE, ALEATORIO. shuffle aleatorio: sortear um numero, exemplo de distinct 4: sortear 1 ao 4, e selecionar pelo indice
// ADICIONAR MINIMUM SCROBBLES COMO QUERY URL, QUAL O VALOR MINIMO PARA COMPARAÇÃO, ASSIM COMO ADICIONEI MAXIMUMSCROBBLES
// ADICIONAR MIDDLEWARE PARA ROTA NÃO ENCONTRADA ge detected. Starting incremental compilation...
// EM LASTFMUTILS REVISAR     return Array.from(mapDistincted.values()).map(tracks => tracks.slice(0, 4)).flat(). SLICE 0, 4 POR QUE?
// PERGUNTAR PARA O CHAT GPT COMO POSSO USAR MELHOR O BANCO DE DADOS
// AbortController para não ficar rodando código no background quando já ter logado os resultados no navegador
import { ParametersURLInterface, TrackDataLastFm, RecentTracks, TrackWithPlaycount, topTracksAllTime, DateSource, CollectedTracksSingle, TrackWithPlaycountLastListened } from './../models/last-fm.model';
import { AxiosError } from "axios"
import dayjs, { } from "dayjs"
import utc from "dayjs/plugin/utc"
import { lastFmMapper } from "../utils/lastFmMapper"
import { calculateWindowValueToFetch, deleteDuplicateKeepLatest, deleteTracksNotInRange, deleteTracksUserPlaycount, distinctArtists, getLatestTracks, getTotalBlocks, getTracksByAccountPercentage, groupTracksByKey, normalizeTracks, runThroughPages } from "../utils/lastFmUtils"
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
    private isDualFetch: boolean
    private isComparison: boolean
    private isCandidate: boolean

    constructor(
        private readonly mapper = lastFmMapper,
    ) {
        this.lastFmRepository = new LastFmRepository()
        this.shouldRun = true
        this.fetchInDays = 10
        this.quantityOfTracksFetched = 0
        this.runLastTimeListened = true
        this.timeLoopHasRun = 0
        this.isDualFetch = false
        this.isComparison = false
        this.isCandidate = false
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

        const fetchWithRetry = async (params: ParametersURLInterface, endpoint?: string) => {
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
                    limit: String(limit),
                    user: typeof user === "string" ? user : user.name,
                    from: String(from),
                    to: String(to),
                    api_key: process.env.LAST_FM_API_KEY!,
                    page: String(page),
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
            api_key: process.env.LAST_FM_API_KEY!
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
            api_key: process.env.LAST_FM_API_KEY!,
            limit: "0"
        }

        const response = await safeAxiosGet<TrackWithPlaycount>(this.endpoint, params)

        const userPlaycount = response?.track?.userplaycount ?? "0";
        return userPlaycount
    }


    // COMEÇAR MUDANÇA POR AQUIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
    // TROCAR NOME ???? 
    // tem o mesmo retorno
    async tracksWithinPercentage(
        params: ParametersURLInterface,
        dateSource: DateSource
    ) {
        let topOldTracks = await runThroughPages(params, dateSource) as TrackDataLastFm[]

        // Remove duplicados
        topOldTracks = deleteDuplicateKeepLatest(topOldTracks)

        // Filtra pelo percentageToCompare
        return topOldTracks
    }

    // async tracksWithinPercentage(
    //     userLastFm: string,
    //     limit: number,
    //     startOfDay: number,
    //     endOfDay: number,
    //     endpointEachDay?: string[],
    // ) {
    //     let topOldTracksRaw: trackRecentData[] = []
    //     let topOldTracks: TrackDataLastFm[] = []

    //     if (!endpointEachDay) {
    //         endpointEachDay = createURL(
    //             true,
    //             "user.getrecenttracks",
    //             limit,
    //             userLastFm,
    //             startOfDay,
    //             endOfDay,
    //             process.env.LAST_FM_API_KEY as string,
    //             "1",
    //             "json",
    //         )
    //     }

    //     const limitConcurrency = pLimit(15)

    //     await Promise.all(
    //         endpointEachDay.map(endpoint => limitConcurrency(async () => {
    //             const response = await safeAxiosGet<RecentTracks>(endpoint)

    //             if (!response) {
    //                 return
    //             }

    //             const tracks = Array.isArray(response.recenttracks.track)
    //                 ? response.recenttracks.track
    //                 : [response.recenttracks.track]

    //             topOldTracksRaw.push(...tracks.map(t => ({ ...t })));

    //         }))
    //     )


    //     // Mapeia tudo de uma vez
    //     topOldTracks = this.mapper.toRecentAndOldTracksData([
    //         { recenttracks: { track: topOldTracksRaw } }
    //     ])

    //     // Remove duplicados
    //     topOldTracks = deleteDuplicateKeepLatest(topOldTracks)

    //     // Filtra pelo percentageToCompare
    //     return topOldTracks
    // }
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
        userLastFm: string,
        percentageToCompare: number,
        maximumScrobbles: number | boolean,
        params: ParametersURLInterface,
        dateSource: DateSource
    ) {
        // const limitConcurrency = pLimit(5)

        // 1. Busca todas as tracks
        const collected = await runThroughPages(params, dateSource) as CollectedTracksSingle

        const recentCandidateTracks = collected.tracks.get("candidate") ?? []
        const oldComparisonTracks = collected.tracks.get("comparison") ?? []


        // 2. Normaliza os dois conjuntos
        const recentNormalized = normalizeTracks(recentCandidateTracks)
        const oldNormalized = normalizeTracks(oldComparisonTracks)

        // 3. Cria Set das tracks recentes
        const recentKeys = new Set(recentNormalized.map(t => t.key))

        // 4. OLD - RECENT  → músicas que não são mais escutadas
        const notListenedAnymore = oldNormalized.filter(
            t => !recentKeys.has(t.key)
        )

        // 5. Agrupa apenas as antigas não escutadas
        const uniqueKeys = new Set(
            notListenedAnymore.map(t => t.key)
        )

        const groupedOld = groupTracksByKey(notListenedAnymore, uniqueKeys)

        // 6. Pega a última vez que cada música foi escutada
        const latestTracks = getLatestTracks(groupedOld)

        this.quantityOfTracksFetched = latestTracks.size

        // 7. Busca playcount real
        // const tracksWithPlaycount = await Promise.all(
        //     Array.from(latestTracks.values()).map(track =>
        //         limitConcurrency(async () => {
        //             const count = await this.getPlaycountOfTrack(
        //                 userLastFm,
        //                 track.name,
        //                 track.artist
        //             )
        //             return { ...track, userplaycount: count }
        //         })
        //     )
        // )
        // NORMALIZANDO

        const normalizedResults: TrackWithPlaycountLastListened[] =
            Array.from(latestTracks.values()).map(t => ({
                ...t,
                userplaycount: String(t.userplaycount ?? "0")
            }))

        // 8. Aplica filtros de playcount
        let filtered: TrackWithPlaycountLastListened[] = normalizedResults.filter(track => {
            const playcount = Number(track.userplaycount)
            if (typeof maximumScrobbles === "number") {
                return playcount >= percentageToCompare && playcount < maximumScrobbles
            }
            return playcount >= percentageToCompare
        })



        // 9. Remove duplicatas e garante range de dias

        const oldComparisonWithPlaycount: TrackWithPlaycountLastListened[] =
            oldComparisonTracks.map(t => ({
                ...t,
                userplaycount: String(t.userplaycount ?? "0")
            }))

        filtered = deleteDuplicateKeepLatest(filtered)
        filtered = deleteTracksNotInRange(
            this.fetchInDays,
            filtered,
            oldComparisonWithPlaycount
        )



        // 10 Cria um conjunto com todas as músicas escutadas no período candidato
        // e remove essas músicas do resultado final.
        // Isso evita retornar músicas que existiam no período antigo,
        // mas que foram escutadas recentemente.

        const candidateKeys = new Set(
            recentCandidateTracks.map(t => t.key)
        )

        filtered = filtered.filter(track => !candidateKeys.has(track.key))

        // 11. Customiza o texto da data
        const finalFiltered = filtered.map(track => {

            const textBetweenDate = `(${params.comparisonfrom} → ${params.comparisonTo} and ${params.candidateFrom} → ${params.candidateTo})`

            const text = dayjs(params.candidateTo).isSame(dayjs(), "day")
                ? ` Not listened during the analyzed period ${this.fetchInDays} days`
                : `Not listened within the selected periods ${textBetweenDate}`


            return {
                ...track,
                date: {
                    uts: track.date.uts,
                    "#text": text
                }
            }
        })

        return finalFiltered
    }

    async rediscoverLovedTracks(
        userlastfm: string,
        percentage: number,
        limit: number,
        fetchInDays: number,
        fetchForDistinct: number | undefined,
        maximumScrobbles: number | undefined,
        candidateFrom: string | undefined,
        candidateTo: string | undefined,
        comparisonFrom: string | undefined,
        comparisonTo: string | undefined
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

        if (typeof maximumScrobbles !== "number") {
            maximumScrobbles = Number({
                data: {
                    toptracks: {
                        track: [topTrack.toptracks.track[0]]
                    },
                    userplaycount: scrobbleQuantityTopMusic
                }
            }.data.userplaycount)
        }

        //REVISAR PARA PASSAR COMO PARAMETRO PARA LASTTIMEMUSICLISTENED
        //CRIAR CACHE PARA USERPLAYCOUNT


        const percentageToCompareTopMusic = Math.ceil((Number(maximumScrobbles) * 2) / 100)
        let lastTimeListened: TrackDataLastFm[] = []
        let lastTimeListenedLoop: TrackDataLastFm[] = []

        // --------------------------------------------------------------------------------------
        // @ts-ignore
        // --------------------------------------------------------------------------
        let totalBlocks = getTotalBlocks(creationAccountUnixDate, windowValueToFetch)
        let oldTracksWithinPercentageLoop: TrackDataLastFm[] = []
        const containOldTracks: TrackDataLastFm[] = []

        this.isCandidate = candidateFrom ? true : false
        this.isComparison = comparisonFrom ? true : false

        this.isDualFetch = this.isCandidate && this.isComparison ? true : false

        // REMOVER O WHILE ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????
        while (this.shouldRun) {


            this.timeLoopHasRun += 1

            // if (percentage) {
            //     const { fromDate, toDate } = getTracksByAccountPercentage(
            //         creationAccountUnixDate,
            //         percentage,
            //         windowValueToFetch,
            //         offset
            //     )

            //     endpoints = createURL(
            //         true,
            //         "user.getrecenttracks",
            //         totalBlocks,
            //         userlastfm,
            //         fromDate,
            //         toDate,
            //         process.env.LAST_FM_API_KEY!,
            //         "1",
            //         "json",
            //         true,
            //         creationAccountUnixDate,
            //         percentage,
            //         windowValueToFetch,
            //         offset
            //     );
            // }

            const dataSource: DateSource = this.isDualFetch
                ? "candidate&comparison"
                : this.isComparison
                    ? "comparison"
                    : "candidate"

            const params: ParametersURLInterface = {
                comparisonfrom: this.isComparison ? comparisonFrom : undefined,
                comparisonTo: this.isComparison ? comparisonTo : undefined,
                candidateFrom: this.isCandidate ? candidateFrom : undefined,
                candidateTo: this.isCandidate ? candidateTo : undefined,
                from: "",
                to: "",
                method: "user.getrecenttracks",
                user: userlastfm,
                limit: "200",
                format: "json",
                page: "1",
                api_key: process.env.LAST_FM_API_KEY!,
            }


            // let paramsTrackWithinPercentage: ParametersURLInterface | {} = {}

            if (dataSource === "comparison" || dataSource === "candidate") {
                oldTracksWithinPercentageLoop = await this.tracksWithinPercentage(params, dataSource)
                containOldTracks.push(...oldTracksWithinPercentageLoop)
                lastTimeListened = deleteDuplicateKeepLatest(lastTimeListened)
                lastTimeListened = deleteTracksNotInRange(this.fetchInDays, lastTimeListened, containOldTracks)

                const limitConcurrency = pLimit(5)
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

            } else {

                // if (offset >= totalBlocks) {
                //     totalBlocks = getTotalBlocks(creationAccountUnixDate, windowValueToFetch)
                // }

                if (this.runLastTimeListened) {
                    lastTimeListenedLoop = await this.getLastTimeMusicListened(userlastfm, percentageToCompareTopMusic, maximumScrobbles!, params, dataSource) as TrackDataLastFm[]
                    lastTimeListenedLoop = deleteDuplicateKeepLatest(lastTimeListenedLoop)

                    this.quantityOfTracksFetched = lastTimeListenedLoop.length
                    this.runLastTimeListened = false
                }

                // if (this.runLastTimeListened === false && this.quantityOfTracksFetched < Number(limit)) {

                //     lastTimeListenedLoop = await this.getLastTimeMusicListened(containOldTracks, userlastfm, percentageToCompareTopMusic, maximumScrobbles!, params, dataSource) as TrackDataLastFm[]
                //     lastTimeListenedLoop = deleteDuplicateKeepLatest(lastTimeListenedLoop)
                //     console.log("entrei aqui 2", lastTimeListened.length)
                //     this.quantityOfTracksFetched = lastTimeListenedLoop.length
                // }


                lastTimeListened.push(...lastTimeListenedLoop)

                // const merged = [...lastTimeListened, ...(Array.isArray(lastTimeListenedLoop) ? lastTimeListenedLoop : [lastTimeListenedLoop])]
                // lastTimeListened = deleteDuplicateKeepLatest(merged)
                // OUTROS FILTROS IRIAM VIR AQUI ABAIXO

                const limitConcurrency = pLimit(5)
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

                this.shouldRun = false

            }
        }



        //getPlaycountOfTrack
        // return lastTimeListened

        //if music not appears in 3 month
        return lastTimeListened.slice(0, Number(limit)).sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
    }
}