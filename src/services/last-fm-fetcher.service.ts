// NÃO USAR BANCO DE DADOS E UTILIZAR APENAS SESSION? 

// se o codigo estiver rodando por muito tempo e n houver retorno, cancelar e dar erro 


// testes de carga
// forever e pm2
// nginx e helmet protecao
// compression


// middleware gettoptrack, se não existir, usuário não existe.

import 'dotenv/config';

import { ParametersURLInterface, TrackDataLastFm, RecentTracks, TrackWithPlaycount, topTracksAllTime, CollectedTracksSingle, TrackWithPlaycountLastListened } from './../models/last-fm.model';
import dayjs, { } from "dayjs"
import { deleteDuplicateKeepLatest, deleteTracksNotInRange, distinctArtists, getLatestTracks, groupTracksByKey, JobCanceledError, normalizeTracks, runThroughPages } from "../utils/lastFmUtils"
import { LastFmFullProfile } from "../models/last-fm.auth.model"
import { safeAxiosGet } from '../utils/lastFmUtils';
import { redis } from '../infra/redis';
import { Job } from 'bullmq';

export class LastFmFetcherService {

    private readonly endpoint = "https://ws.audioscrobbler.com/2.0/"


    async loopFetchApi(
        signal: AbortSignal,
        limit: number,
        user: string | LastFmFullProfile,
        page: number,
        from?: number,
        to?: number,
    ): Promise<RecentTracks[]> {

        const responses: RecentTracks[] = []

        while (true) {
            if (signal?.aborted) throw new JobCanceledError()
            const response = await safeAxiosGet<RecentTracks>(
                this.endpoint,
                {
                    method: "user.getrecenttracks",
                    limit: String(limit),
                    user: typeof user === "string" ? user : user.name,
                    from: String(from),
                    to: String(to),
                    api_key: process.env.LAST_FM_API_KEY!,
                    page: String(page),
                    format: "json",
                },
                { signal }
            )

            if (signal?.aborted) throw new JobCanceledError()

            if (!response || response.recenttracks.track.length === 0) {
                break
            }

            responses.push(response)
            page += 1
        }

        return responses
    }




    async getTopTracksAllTime(username: string, limit: string, signal: AbortSignal) {
        const params = {
            method: "user.gettoptracks",
            format: "json",
            user: username,
            period: "overall",
            limit,
            api_key: process.env.LAST_FM_API_KEY!
        }

        if (signal?.aborted) throw new JobCanceledError()
        const response = await safeAxiosGet(this.endpoint, params, { signal }) as topTracksAllTime
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

        if (signal?.aborted) throw new JobCanceledError()
        const response = await safeAxiosGet<TrackWithPlaycount>(this.endpoint, params, { signal })

        const userPlaycount = response?.track?.userplaycount ?? "0";
        return userPlaycount
    }

    async getLastTimeMusicListened(
        signal: AbortSignal,
        params: ParametersURLInterface,
        fetchInDays: number,
        job: Job,
    ) {
        // const limitConcurrency = pLimit(5)

        // 1. Busca todas as tracks
        if (signal?.aborted) throw new JobCanceledError()
        const collected = await runThroughPages(params, signal, job) as CollectedTracksSingle
        if (signal?.aborted) throw new JobCanceledError()
        const recentCandidateTracks = collected?.tracks?.get("candidate") ?? []
        const oldComparisonTracks = collected?.tracks?.get("comparison") ?? []


        // 2. Normaliza os dois conjuntos
        const recentNormalized = normalizeTracks(recentCandidateTracks)
        const oldNormalized = normalizeTracks(oldComparisonTracks)


        // 3. Cria Set das tracks recentes
        const recentKeys = new Set(recentNormalized.map(t => t.key))

        // 4. OLD - RECENT  -> músicas que não são mais escutadas
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

        // 8. se existir filtro de musicas maximas de um artista no resultado, se é aplicado


        // 8. Aplica filtros de playcount se existir
        let filtered: TrackWithPlaycountLastListened[] = normalizedResults

        // 9. Remove duplicatas e garante range de dias

        const oldComparisonWithPlaycount: TrackWithPlaycountLastListened[] =
            oldComparisonTracks.map(t => ({
                ...t,
                userplaycount: String(t.userplaycount ?? "0")
            }))
        filtered = deleteDuplicateKeepLatest(filtered)
        const safeOldComparison = oldComparisonWithPlaycount.filter(
            (t): t is TrackWithPlaycountLastListened =>
                !!t && !!t.artist && !!t.name && !!t.date
        )
        filtered = deleteTracksNotInRange(fetchInDays, filtered, safeOldComparison)


        // 10. Cria um conjunto com todas as músicas escutadas no período candidato
        // e remove essas músicas do resultado final.
        // Isso evita retornar músicas que existiam no período antigo,
        // mas que foram escutadas recentemente.

        const candidateKeys = new Set(
            recentCandidateTracks.map(t => t.key)
        )

        filtered = filtered.filter(track => !candidateKeys.has(track.key))

        // 12. Customiza o texto da data
        const finalFiltered = filtered.map(track => {

            const textBetweenDate = `(${params.comparisonFrom} → ${params.comparisonTo} and ${params.candidateFrom} → ${params.candidateTo})`

            const text = dayjs(params.candidateTo).isSame(dayjs(), "day")
                ? ` Not listened during the analyzed period ${fetchInDays} days`
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
        fetchInDays: number,
        fetchForDistinct: number | undefined,
        candidateFrom: string | undefined,
        candidateTo: string | undefined,
        comparisonFrom: string | undefined,
        comparisonTo: string | undefined,
        signal: AbortSignal,
        job: Job
    ) {

        console.log("JOB ", job.id, " RODANDO")

        if (signal?.aborted) throw new JobCanceledError()

        if (signal?.aborted) throw new JobCanceledError()
        if (signal?.aborted) throw new JobCanceledError()

        if (signal?.aborted) throw new JobCanceledError()

        if (signal?.aborted) throw new JobCanceledError()

        let lastTimeListened: TrackDataLastFm[] = []
        let loopCount = 0

        let page = 1
        while (true && !signal.aborted) {

            if (signal?.aborted) throw new JobCanceledError()
            const canceled = await redis.get(`rediscover:cancel:${job.id}`)

            if (canceled) {
                throw new JobCanceledError()
            }
            if (signal?.aborted) throw new JobCanceledError()
            loopCount += 1
            if (loopCount > 30) break

            const params: ParametersURLInterface = {
                comparisonFrom,
                comparisonTo,
                candidateFrom,
                candidateTo,
                method: "user.getrecenttracks",
                user: userlastfm,
                limit: "200",
                format: "json",
                page: String(page),
                api_key: process.env.LAST_FM_API_KEY!,
                from: "",
                to: ""
            }

            // if (signal?.aborted) throw new JobCanceledError()
            // const batch = await this.getLastTimeMusicListened(
            //     signal,
            //     minimumScrobbles,
            //     maximumScrobbles!,
            //     params,
            //     dataSource,
            //     filterParams,
            //     fetchInDays
            // ) as TrackDataLastFm[]

            // if (signal?.aborted) throw new JobCanceledError()

            // lastTimeListened.push(...batch)
            // lastTimeListened = deleteDuplicateKeepLatest(lastTimeListened)

            if (signal?.aborted) throw new JobCanceledError()
            const lastTimeListenedLoop = await this.getLastTimeMusicListened(
                signal,
                params,
                fetchInDays,
                job
            ) as TrackDataLastFm[]
            if (signal?.aborted) throw new JobCanceledError()
            
            lastTimeListened.push(...lastTimeListenedLoop)
            lastTimeListened = deleteDuplicateKeepLatest(lastTimeListened)
            console.log("Tamanho final da resposta: ", lastTimeListened.length)
            break
        }

        if (typeof fetchForDistinct === "number") {
            lastTimeListened = distinctArtists(lastTimeListened, fetchForDistinct)
        }


        return lastTimeListened
    }
}