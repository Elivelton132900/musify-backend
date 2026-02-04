// NÃO USAR BANCO DE DADOS E UTILIZAR APENAS SESSION? 
// GERAR PLAYLIST
// se na requisiçao, na hora de buscar collectpaginatedtrackssingle, já rodar todo o código para tentar atingir o limit o quanto antes
// atingit o limit = se limit 10, e requisicao ja retornou 10 musicas que se encaixam no filtro, parar o código.
// já fazer isso aqui mesmo no service. a funçao que retorna os dados, por pagina, é runThroughPages.
// separar em chunks as tracks para ir buscando uma por uma para ter o minimo de processamento possível?

//se minimum scrobble estiver presente, então scrobbles devem ser mostrados
// se fetchindays é 40 dias, a diferença entre datas de candidate e compare não pode ser menor que 40 -> middleware

// DISTINCT NO QUERYPARAMS SENDO SALVO COMO HASH OU NÃO? SE NÃO, SE TER ESSA QUERY NA URL, FORMATAR O RESULTADO COM O VALOR DO DISTINCT

// dual fetch faz sentido? comparison || candidate || comparison&candidate dualfetch

// testes de carga
// forever e pm2
// nginx e helmet protecao
// compression
// mongodbatlas gratuito 500mb

import 'dotenv/config';

import { ParametersURLInterface, TrackDataLastFm, RecentTracks, TrackWithPlaycount, topTracksAllTime, DateSource, CollectedTracksSingle, TrackWithPlaycountLastListened } from './../models/last-fm.model';
import { AxiosError } from "axios"
import dayjs, { } from "dayjs"
import utc from "dayjs/plugin/utc"
import { lastFmMapper } from "../utils/lastFmMapper"
import { calculateWindowValueToFetch, deleteDuplicateKeepLatest, deleteTracksNotInRange, deleteTracksUserPlaycount, distinctArtists, getLatestTracks, getTracksByAccountPercentage, groupTracksByKey, normalizeTracks, runThroughPages } from "../utils/lastFmUtils"
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
        signal: AbortSignal,
        limit: number,
        user: string | LastFmFullProfile,
        page: number,
        from?: number,
        to?: number,
    ): Promise<RecentTracks[]> {

        this.shouldRun = true

        let response: RecentTracks | null = null
        const allResponses: RecentTracks[] = []

        const fetchWithRetry = async (params: ParametersURLInterface, endpoint?: string) => {
            if (!endpoint) {
                response = await safeAxiosGet<RecentTracks>(this.endpoint, params, { signal });
                return !response ? null : response
            } else {
                response = await safeAxiosGet<RecentTracks>(endpoint, params, { signal })
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
        signal: AbortSignal,
        minimumScrobbles: number,
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
            minimumScrobbles,
            windowValueToFetch as number,
            offset
        )

        if (dayjs.unix(Number(toDate)).utc().isAfter(dayjs(), "day") || dayjs.unix(Number(fromDate)).utc().isAfter(dayjs(), "day")) {
            return []
        }

        dayjs.extend(utc)
        let responseTracks: RecentTracks[] = []

        responseTracks.push(...await this.loopFetchApi(signal, limit, user, page, from, to))



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
                    signal,
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
        signal: AbortSignal,
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
            signal,
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

    async getTopRecentTrack(signal: AbortSignal, user: LastFmFullProfile | string, percentage: number, limit: number, from: number, to: number) {

        const offset = 0
        const windowValueToFetch = 198
        const page = 1

        const recentTracks = await this.getTracksByPercentage(
            signal,
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

    async getTopTracksAllTime(username: string, limit: string, signal: AbortSignal) {
        console.log("USER: ", username, limit)
        const params = {
            method: "user.gettoptracks",
            format: "json",
            user: username,
            period: "overall",
            limit,
            api_key: process.env.LAST_FM_API_KEY!
        }


        console.log("params dentro da funcao ", params)
        console.log("vou dar erro aqui")
        const response = await safeAxiosGet(this.endpoint, params, { signal }) as topTracksAllTime
        console.log("...")
        return response
    }


    async getPlaycountOfTrack(signal: AbortSignal, user: LastFmFullProfile | string, musicName: string, artistName: string) {

        const params = {
            method: "track.getInfo",
            user: typeof user === "string" ? user : user.name,
            track: musicName,
            artist: artistName,
            format: "json",
            api_key: process.env.LAST_FM_API_KEY!,
            limit: "0"
        }

        const response = await safeAxiosGet<TrackWithPlaycount>(this.endpoint, params, { signal })

        const userPlaycount = response?.track?.userplaycount ?? "0";
        return userPlaycount
    }

    async tracksWithinPercentage(
        signal: AbortSignal,
        params: ParametersURLInterface,
        dateSource: DateSource
    ) {
        let topOldTracks = await runThroughPages(params, dateSource, signal) as TrackDataLastFm[]

        // Remove duplicados
        topOldTracks = deleteDuplicateKeepLatest(topOldTracks)

        // Filtra pelo percentageToCompare
        return topOldTracks
    }


    async getLastTimeMusicListened(
        signal: AbortSignal,
        minimumScrobbles: number,
        maximumScrobbles: number | boolean,
        params: ParametersURLInterface,
        dateSource: DateSource,
    ) {
        // const limitConcurrency = pLimit(5)

        // 1. Busca todas as tracks
        const collected = await runThroughPages(params, dateSource, signal) as CollectedTracksSingle

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
                return playcount >= minimumScrobbles && playcount < maximumScrobbles
            }
            return playcount >= minimumScrobbles
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
        limit: number,
        fetchInDays: number,
        fetchForDistinct: number | undefined,
        maximumScrobbles: number | undefined,
        candidateFrom: string | undefined,
        candidateTo: string | undefined,
        comparisonFrom: string | undefined,
        comparisonTo: string | undefined,
        minimumScrobbles: number,
        signal: AbortSignal,
        order: "descending" | "ascending"
    ) {

        if (signal.aborted) {
            throw new Error("Aborted")
        }

        // reinicializando variaveis para que o proximo job possa rodar
        this.shouldRun = true
        this.runLastTimeListened = true
        this.timeLoopHasRun = 0
        this.quantityOfTracksFetched = 0
        this.isDualFetch = false
        this.isComparison = false
        this.isCandidate = false

        this.fetchInDays = fetchInDays

        console.log("errooooooo 1")
        const topTrack: topTracksAllTime = await this.getTopTracksAllTime(userlastfm, "1", signal)
        console.log("errooooooooo 2")
        const trackName = topTrack.toptracks.track[0].name
        const artistName = topTrack.toptracks.track[0].artist.name
        const scrobbleQuantityTopMusic = await this.getPlaycountOfTrack(signal, userlastfm, trackName, artistName)
        console.log("erroooooooo 3")
        let countLoop = 0
        let offset = 0

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

        //CRIAR CACHE PARA USERPLAYCOUNT

        let lastTimeListened: TrackDataLastFm[] = []
        let lastTimeListenedLoop: TrackDataLastFm[] = []

        let oldTracksWithinPercentageLoop: TrackDataLastFm[] = []
        const containOldTracks: TrackDataLastFm[] = []

        this.isCandidate = candidateFrom ? true : false
        this.isComparison = comparisonFrom ? true : false

        this.isDualFetch = this.isCandidate && this.isComparison ? true : false

        while (this.shouldRun && !signal.aborted) {


            this.timeLoopHasRun += 1

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


            if (dataSource === "comparison" || dataSource === "candidate") {
                oldTracksWithinPercentageLoop = await this.tracksWithinPercentage(signal, params, dataSource)
                containOldTracks.push(...oldTracksWithinPercentageLoop)
                lastTimeListened = deleteDuplicateKeepLatest(lastTimeListened)
                lastTimeListened = deleteTracksNotInRange(this.fetchInDays, lastTimeListened, containOldTracks)

                const limitConcurrency = pLimit(5)
                lastTimeListened = await Promise.all(
                    lastTimeListened.map(track => limitConcurrency(async () => {
                        const trackName = track.name
                        const artistName = track.artist
                        const UserPlaycount = await this.getPlaycountOfTrack(signal, userlastfm, trackName, artistName)

                        return {
                            ...track,
                            userplaycount: UserPlaycount
                        }
                    }))
                )
                lastTimeListened = deleteTracksUserPlaycount(minimumScrobbles, lastTimeListened, maximumScrobbles)
                if (typeof fetchForDistinct === 'number') {
                    lastTimeListened = distinctArtists(lastTimeListened, fetchForDistinct, order, limit)
                }
                this.quantityOfTracksFetched = lastTimeListened.length
                offset += 1
                countLoop += 1

            } else {

                if (this.runLastTimeListened) {
                    lastTimeListenedLoop = await this.getLastTimeMusicListened(signal, minimumScrobbles, maximumScrobbles!, params, dataSource) as TrackDataLastFm[]
                    lastTimeListenedLoop = deleteDuplicateKeepLatest(lastTimeListenedLoop)

                    this.quantityOfTracksFetched = lastTimeListenedLoop.length
                    this.runLastTimeListened = false
                }

                lastTimeListened.push(...lastTimeListenedLoop)

                // const limitConcurrency = pLimit(5)
                // lastTimeListened = await Promise.all(
                //     lastTimeListened.map(track => limitConcurrency(async () => {
                //         const trackName = track.name
                //         const artistName = track.artist
                //         const UserPlaycount = await this.getPlaycountOfTrack(signal, userlastfm, trackName, artistName)

                //         return {
                //             ...track,
                //             userplaycount: UserPlaycount
                //         }
                //     }))
                // )
                // lastTimeListened = deleteTracksUserPlaycount(minimumScrobbles, lastTimeListened, maximumScrobbles)
                // if (typeof fetchForDistinct === 'number') {
                //     lastTimeListened = distinctArtists(lastTimeListened, fetchForDistinct, order, limit)
                // }
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

        if (order === "descending") {
            return lastTimeListened.slice(0, Number(limit)).sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
        }

        return lastTimeListened.slice(0, Number(limit)).sort((a, b) => Number(a.userplaycount) - Number(b.userplaycount))
    }
}