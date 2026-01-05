import { DateSource, DatesURLQueyParam, ParamsBySource, RunThroughTypeResult, FetchPageResultSingle, TrackDataLastFm, FetchPageResultDual, CollectedTracksSingle, CollectedTracksDual, TrackWithPlaycount, RecentTracks } from './../models/last-fm.model';
import { LastFmFullProfile, ParamsHash } from "../models/last-fm.auth.model"
import crypto from "crypto"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';
import { ParametersURLInterface, trackRecentData } from "../models/last-fm.model";
import axios from "axios";
import { AxiosError } from "axios";
import { Agent as HttpsAgent } from "https";
import { Agent as HttpAgent } from "http";
import pLimit from "p-limit";


export function createHash(content: ParamsHash) {

    const sortedKeys = Object.keys(content).sort()

    let concatenated = ""
    for (const key of sortedKeys) {
        const typedKey = key as keyof ParamsHash
        concatenated += key + content[typedKey]
    }

    concatenated += process.env.LAST_FM_SHARED_SECRET

    const api_sig: string = crypto.createHash("md5").update(concatenated).digest("hex")

    return api_sig
}

export function getLoginUrl(api_key: string): string {

    const params = new URLSearchParams({
        api_key
    })

    return `http://www.last.fm/api/auth/?${params.toString()}`
}

export function unixTimeToUTC(unixtime: number) {
    dayjs.extend(utc);

    const utcDateTime = dayjs.unix(Number(unixtime)).utc()

    return utcDateTime

}


export function utcToUnixTimestamp(date: dayjs.Dayjs) {
    const nowUtc = dayjs(date).utc().unix();
    return nowUtc
}


export function getTracksByAccountPercentage(
    accountCreationUnixTime: number,
    percentage: number,
    windowValueToFetch: number,
    offset: number
): { fromDate: number; toDate: number } {

    const creationDate = unixTimeToUTC(accountCreationUnixTime)
    const now = dayjs().utc()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const totalLifeSeconds = now.unix() - creationDate.unix()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const secondsToPoint = totalLifeSeconds * (percentage / 100)

    // ponto de início da janela, com deslocamento em dias
    let fromDate: dayjs.Dayjs | number = creationDate
        .add(secondsToPoint, "second")
        .add(offset, "day");

    let toDate: dayjs.Dayjs | number = fromDate.add(windowValueToFetch, "day"); // janela de x dias (pode ajustar)

    fromDate = utcToUnixTimestamp(fromDate)
    toDate = utcToUnixTimestamp(toDate)
    const today = dayjs().utc().unix()
    // Nunca passar do dia atual
    return {
        fromDate: unixTimeToUTC(fromDate).isAfter(now) ? today : fromDate,
        toDate: unixTimeToUTC(toDate).isAfter(now) ? today : toDate
    }
}


export function getTotalBlocks(accountCreationUnixTime: number, windowValueToFetch: number): number {
    const creation = dayjs.unix(accountCreationUnixTime).utc()
    const now = dayjs().utc()

    const totalDias = now.diff(creation, "day")
    return Math.ceil(totalDias / windowValueToFetch)
}

export function getForgottenTracks(oldTracks: TrackDataLastFm[], recentTracks: TrackDataLastFm[]) {
    const noMoreListenedTracks = oldTracks.filter((track) => {
        const isStillListened = recentTracks.some((t) => {
            t.name.trim().toLowerCase() + "-" +
                t.artist.trim().toLowerCase() ===
                track.name.trim().toLowerCase() + "-" +
                track.artist.trim().toLowerCase()
        })
        return !isStillListened
    })


    return noMoreListenedTracks
}

export function deleteDuplicateKeepLatest<T extends { name: string; artist: string; date: { uts?: string | number }} >(
    tracks: T[]
) {
    const groups = new Map<string, T[]>()
    for (const track of tracks) {

        const artist = typeof track?.artist === "string" ? track.artist : track.artist?.["#text"] ?? ""

        const key = normalize(track.name, artist)

        if (!groups.has(key)) {
            groups.set(key, [])
        }

        groups.get(key)!.push(track)
    }

    let results: T[] = []

    for (const [_key, tracks] of groups) {
        const greatestUts = Math.max(...tracks.map(a =>
            Number(a.date?.uts)
        ))


        // not listened in 
        const greatestRegister = tracks.find(a => Number(a.date?.uts) === greatestUts)!
        results.push(greatestRegister)
    }

    return results
}

// function latestTracksListened<
//   T extends {
//     name: string
//     artist: string
//     date: { uts?: string | number }
//   }
// >(
//   recentTracks: T[],
//   oldTracks: TrackDataLastFm[]
// ): T[] {

//   const latestMap = new Map<string, T>()

//   for (const track of recentTracks) {
//     const key = normalize(track.name, track.artist)
//     latestMap.set(key, track)
//   }

//   for (const track of oldTracks) {
//     const key = normalize(track.name, track.artist)

//     const current = latestMap.get(key)
//     if (!current) continue

//     if (
//       Number(track.date?.uts) > Number(current.date?.uts)
//     ) {
//       continue
//     }
//   }

//   return [...latestMap.values()]
// }

export function deleteTracksNotInRange<T extends {
    name: string,
    artist: string, 
    date: {uts?: string | number; "#text"?: string}
}>(
    rangeDays: number,
    recentTracks: T[],
    oldTracks: T[]
): T[]{

    const tracks = oldTracks
    const limitDate = dayjs().subtract(rangeDays, "days").utc().unix()
    const groups = new Map<string, T>()

    for (const track of tracks) {
        const artist = typeof track.artist === "string"
            ? track.artist
            : track.artist['#text']

        const key = normalize(track.name, artist)
        const uts = Number(track.date?.uts)
        if (isNaN(uts)) continue


        const current = groups.get(key)
        if (!current || uts > Number(current.date?.uts)) {
            groups.set(key, track)
        }

        const updated = groups.get(key)
        const daysWithoutListening = dayjs().utc().diff(dayjs.unix(Number(updated?.date.uts)).utc(), "day")

        if (daysWithoutListening > rangeDays) {
            const updatedTrack = { ...updated! }
            updatedTrack.date!["#text"] = `Not listened in more than ${rangeDays} days`
            groups.set(key, updatedTrack)

        }
    }
    return [...groups.values()].filter(track => Number(track.date?.uts) <= limitDate)
}

export function distinctArtists(alltracks: TrackDataLastFm[], maximumRepetition: number, order: string): TrackDataLastFm[] {

    const artistTracks = new Map<string, TrackDataLastFm[]>()
    const mapDistincted = new Map<string, TrackDataLastFm[]>()


    console.log(
        'maximumRepetition:',
        maximumRepetition,
        typeof maximumRepetition
    )

    for (const track of alltracks) {


        if (!artistTracks.has(track.artist)) {
            artistTracks.set(track.artist, [])
        }

        artistTracks.get(track.artist)!.push(track)
    }

    let tracksFlattened: TrackDataLastFm[] = Array.from(artistTracks.values()).flat()

    if (order === 'descending') {
        tracksFlattened = tracksFlattened.sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))
    } else if (order === 'ascending') {
        tracksFlattened = tracksFlattened.sort((a, b) => Number(a.userplaycount) - Number(b.userplaycount))
    }

    for (const track of tracksFlattened) {
        if (!mapDistincted.has(track.artist)) {
            mapDistincted.set(track.artist, [])
        }

        if (mapDistincted.get(track.artist)!.length < maximumRepetition) {
            mapDistincted.get(track.artist)!.push(track)
        }
    }


    return Array.from(mapDistincted.values()).map(tracks => tracks.slice(0, 4)).flat()
}

export function deleteTracksUserPlaycount(percentageToCompareTopMusic: number, allTracks: TrackDataLastFm[], maximumScrobbles: boolean | number): TrackDataLastFm[] {
    if (typeof maximumScrobbles === 'number') {
        return allTracks.filter((track) => {
            return Number(track?.userplaycount) >= percentageToCompareTopMusic && Number(track?.userplaycount) < maximumScrobbles
        })
    } else {
        return allTracks.filter((track) => {
            return Number(track?.userplaycount) >= percentageToCompareTopMusic
        })
    }
}

export function calculateWindowValueToFetch(totalScrobbles: number) {
    const newAccount = 1000
    const intermediaryAccount = 10000

    if (totalScrobbles < newAccount) {
        return 45
    } else if (totalScrobbles < intermediaryAccount) {
        return 30
    } else {
        return 10
    }
}

export const normalize = (name: string, artist: string) => {
    return (name + "-" + artist)
        .toLowerCase()
        .normalize("NFKD")                  // separa acentos
        .replace(/[\u0300-\u036f]/g, "")    // remove acentos
        .normalize("NFKC")                  // normaliza de volta
        .replace(/[\u00A0\u200B\uFEFF]/g, " ") // NBSP, ZWSP, BOM → espaço
        .replace(/[-–—−]/g, "-")           // normaliza tipos de hífen
        .replace(/\s+/g, " ")               // normaliza múltiplos espaços
        .trim()
}


interface safeAxiosOptions {
    retries?: number,
    delay?: number,
    silent?: boolean
}

const http = axios.create({
    timeout: 5000,
    httpAgent: new HttpAgent({ keepAlive: true, maxSockets: 100 }),
    httpsAgent: new HttpsAgent({ keepAlive: true, maxSockets: 100 })

})

export async function safeAxiosGet<T>(
    url: string,
    params?: ParametersURLInterface,
    options?: safeAxiosOptions,
): Promise<T | null> {



    const { retries = 3, delay = 10000, silent = false } = options || {}

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await http.get<T>(url, { params })
            const data: any = response.data

            if (data?.error) {
                if (!silent) console.warn("Last FM erro: ", data.error, data.message)

                if ([8].includes(data.error) && attempt < retries) {
                    await new Promise(r => setTimeout(r, delay))
                    continue
                    // rate limit exceeded
                } else if ([29].includes(data.error) && attempt < retries) {
                    await new Promise(r => setTimeout(r, 15000))
                }
                return null
            }
            return data as T
        } catch (e: unknown) {
            const error = e as AxiosError
            const retryable = [500, 502, 503, 504].includes(error.response?.status ?? 0)

            if (!silent) {
                console.error(
                    `🚨 Falha Axios (${error.response?.status ?? "sem status"}):`,
                    error.message
                )
                console.log("erro na url ", url)
                console.error(error.response?.data)
                console.error(error.response?.status)
                console.error(error.config?.url)
            }
            if (retryable && attempt < retries) {
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            return null
        }
    }
    return null
}

function returnDates(params: ParametersURLInterface, dataSource: DateSource) {

    if (dataSource === "comparison") {
        const startDayFrom = dayjs.isDayjs(params.comparisonfrom)
            ? String(params.comparisonfrom.startOf("day").utc().unix())
            : ''
        const endDayTo = dayjs.isDayjs(params.comparisonTo)
            ? String(params.comparisonTo.endOf("day").utc().unix())
            : ''
        return { startDayFrom, endDayTo }
    } else if (dataSource === "candidate") {
        const startDayFrom = dayjs.isDayjs(params.candidateFrom)
            ? String(params.candidateFrom.startOf("day").utc().unix())
            : params.from
        const endDayTo = dayjs.isDayjs(params.candidateTo)
            ? String(params.candidateTo.endOf("day").utc().unix())
            : params.to
        return { startDayFrom, endDayTo }
    } else {
        console.log("ANTESSSSS ", params.comparisonfrom)
        const startDayFromComparison = typeof params.comparisonfrom === "string"
            ? String(dayjs(params.comparisonfrom).startOf("day").utc().unix())
            : ''
        const endDayToComparison = typeof params.comparisonTo === "string"
            ? String(dayjs(params.comparisonTo).endOf("day").utc().unix())
            : ''

        const startDayFromCandidate = typeof params.candidateFrom === "string"
            ? String(dayjs(params.candidateFrom).startOf("day").utc().unix())
            : params.from
        const endDayToCandidate = typeof params.candidateTo === "string"
            ? String(dayjs(params.candidateTo).endOf("day").utc().unix())
            : params.to

        console.log("DATEEEEEEEEEEEEEES: ", startDayFromComparison, "",  endDayToComparison, "", startDayFromCandidate, "", endDayToCandidate)
        return { startDayFromComparison, endDayToComparison, startDayFromCandidate, endDayToCandidate }
    }



}

export function createParams(params: ParametersURLInterface, dataSource: DateSource): ParamsBySource {

    // if search for old tracks equals to false, then we are looking for new tracks

    const dates: DatesURLQueyParam = {}

    if (dataSource === "candidate") {

        const { startDayFrom, endDayTo } = returnDates(params, dataSource)

        dates.candidateFrom = startDayFrom
        dates.candidateTo = endDayTo

        return {
            type: "single",
            source: "candidate",
            params: [
                {
                    ...params,
                    from: String(dates.candidateFrom),
                    to: String(dates.candidateTo),
                    page: "1",
                },
            ],
        };
    } else if (dataSource === "comparison") {

        const { startDayFrom, endDayTo } = returnDates(params, dataSource)

        dates.comparisonFrom = startDayFrom
        dates.comparisonTo = endDayTo

        return {
            type: "single",
            source: "comparison",
            params: [
                {
                    ...params,
                    from: String(startDayFrom),
                    to: String(endDayTo),
                    page: "1",
                },
            ],
        }
    } else {
        const {
            startDayFromComparison,
            endDayToComparison,
            startDayFromCandidate,
            endDayToCandidate,
        } = returnDates(params, dataSource)

        console.log("respective", startDayFromComparison, startDayFromCandidate, endDayToComparison, endDayToCandidate)

        return {
            type: "dual",
            candidate: [
                {
                    ...params,
                    from: String(startDayFromCandidate),
                    to: String(endDayToCandidate),
                    page: "1",
                },
            ],
            comparison: [
                {
                    ...params,
                    from: String(startDayFromComparison),
                    to: String(endDayToComparison),
                    page: "1",
                },
            ],
        }

    }
}

function normalizeRecentTrack(track: trackRecentData): TrackDataLastFm {

    const artist =
        typeof track.artist === "string"
            ? track.artist
            : track.artist["#text"]

    return {
        artist,
        name: track.name,
        userplaycount: track.userplaycount,
        url: track.url,
        mbid: track.mbid,
        date: track.date,
        key: normalize(track.name, artist)
    }

}

function normalizeRecentTracks(
    raw: trackRecentData
        | trackRecentData[]
        | undefined

): TrackDataLastFm[] {

    if (!raw) return []

    if (Array.isArray(raw)) {
        //     return raw.map(normalizeRecentTrack);

        return raw.map(a => normalizeRecentTrack(a))
    }

    return [normalizeRecentTrack(raw)]

}


export async function fetchPage(params: ParametersURLInterface, createdParamsList: ParamsBySource): Promise<FetchPageResultSingle | FetchPageResultDual | null> {

    const endpoint = "https://ws.audioscrobbler.com/2.0/";

    if (createdParamsList.type === "single") {
        let response = await safeAxiosGet<RecentTracks>(endpoint, params)

        if (!response?.recenttracks) return null

        const tracks = normalizeRecentTracks(
            response.recenttracks.track
        )

        const attr = response.recenttracks["@attr"]

        if (!attr) return null

        return {
            tracks,
            pagination: {
                page: Number(attr.page),
                totalPages: Number(attr.totalPages)
            }
        }


    } else {
        const candidateResponse = await safeAxiosGet<RecentTracks>(endpoint, params)

        if (!candidateResponse?.recenttracks) return null

        const comparisonResponse = await safeAxiosGet<RecentTracks>(endpoint, params)

        if (!comparisonResponse?.recenttracks) return null

        const candidateTracks = normalizeRecentTracks(candidateResponse.recenttracks.track)
        const comparisonTracks = normalizeRecentTracks(comparisonResponse.recenttracks.track)

        const attrCandidate = candidateResponse.recenttracks["@attr"]
        const attrComparison = comparisonResponse.recenttracks["@attr"]

        if (!attrCandidate || !attrComparison) return null

        return {
            candidate: {
                tracks: candidateTracks,
                pagination: {
                    page: Number(attrCandidate.page),
                    totalPages: Number(attrCandidate.totalPages)
                }
            },
            comparison: {
                tracks: comparisonTracks,
                pagination: {
                    page: Number(attrComparison.page),
                    totalPages: Number(attrComparison.totalPages)
                }
            }
        }
    }
}



async function runThroughType(createdParamsList: ParamsBySource): Promise<RunThroughTypeResult | null> {


    if (createdParamsList.type === "single") {

        for (const paramsItem of createdParamsList.params) {
            const firstPage = await fetchPage(paramsItem, createdParamsList)
            if (!firstPage) return null

            if (firstPage)

                return {
                    type: "single",
                    solo: {
                        page: firstPage as FetchPageResultSingle
                    }
                }
        }
    }
    if (createdParamsList.type === "dual") {

        let candidatePage!: FetchPageResultSingle
        let comparisonPage!: FetchPageResultSingle

        const tracks: RunThroughTypeResult = {
            type: "dual",
            dual: {
                candidatePage,
                comparisonPage
            }
        }

        for (const paramsItems of createdParamsList.candidate) {

            const page = await fetchPage(paramsItems, createdParamsList)

            if (!page || !("candidate" in page)) {
                throw new Error("Dual response invalid")
            }

            tracks.dual.candidatePage = page.candidate
        }

        for (const paramsItems of createdParamsList.comparison) {

            const page = await fetchPage(paramsItems, createdParamsList)
            if (!page || !("comparison" in page)) {
                throw new Error("Dual response invalid")
            }

            tracks.dual.comparisonPage = page.comparison
        }

        return tracks
    }

    return null
}

async function collectPaginatedTracksSingle(
    firstPage: FetchPageResultSingle,
    baseParams: ParametersURLInterface,
    createdParamsList: ParamsBySource
): Promise<CollectedTracksSingle> {

    const mapSingleTracks = new Map<string, TrackDataLastFm[]>()


    const allTracks: TrackDataLastFm[] = [...firstPage.tracks]

    const limitConcurrency = pLimit(5)

    const tasks: Promise<void>[] = []

    for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
        console.log("collectpaginatedtrackssingle page", page)
        tasks.push(
            limitConcurrency(async () => {
                const data = await fetchPage(
                    { ...baseParams, page: String(page) },
                    createdParamsList
                )
                if (data && "tracks" in data) {
                    allTracks.push(...data.tracks)
                }

            })
        )
    }

    mapSingleTracks.set(
        "singleTracks",
        allTracks?.length ? allTracks : []
    )

    await Promise.all(tasks)

    return {
        type: "single",
        tracks: mapSingleTracks
    }
}

function isSingleResult(
  data: FetchPageResultSingle | FetchPageResultDual
): data is FetchPageResultSingle {
  return "tracks" in data
}

async function collectPaginatedTracksDual(
    firstPageCandidate: FetchPageResultSingle,
    firstPageComparison: FetchPageResultSingle,
    baseParams: ParametersURLInterface,
    createdParamsList: ParamsBySource
): Promise<CollectedTracksDual> {


    console.log("ENTREI EM DUAL")


    const dualMap = new Map<string, TrackDataLastFm[]>()

    const allTracksCandidate: TrackDataLastFm[] = [...firstPageCandidate.tracks]
    const allTracksComparison: TrackDataLastFm[] = [...firstPageComparison.tracks]

    const limitConcurrency = pLimit(5)


    const tasksCandidate: Promise<TrackDataLastFm[]>[] = []
    const tasksComparison: Promise<TrackDataLastFm[]>[] = []

    for (let page = 2; page <= firstPageCandidate.pagination.totalPages; page++) {
        tasksCandidate.push(
            limitConcurrency(async () => {
                const data = await fetchPage(
                    { ...baseParams, page: String(page) },
                    createdParamsList
                )
                if (data && isSingleResult(data)) {
                    allTracksCandidate.push(...data.tracks)
                    return data.tracks
                }
                return []
            })

        )
    }



    for (let page = 2; page <= firstPageComparison.pagination.totalPages; page++) {
        console.log("PAGE COMPARISON: ", firstPageComparison.pagination.totalPages)
        tasksComparison.push(
            limitConcurrency(async () => {
                const data = await fetchPage(
                    { ...baseParams, page: String(page) },
                    createdParamsList
                )
                if (data && isSingleResult(data)) {
                    allTracksComparison.push(...data.tracks)
                    return data.tracks
                }
                return []

            })
        )
    }


    const settledComparison = await Promise.allSettled(tasksComparison)
    console.log("TERMINEI SETTLED COMPARISON")
    const comparisonTracks = settledComparison.filter(
        (r): r is PromiseFulfilledResult<TrackDataLastFm[]> => r.status === "fulfilled"
    )
    .flatMap(r => r.value)

    allTracksComparison.push(...comparisonTracks)

    const settledCandidate = await Promise.allSettled(tasksCandidate)
    console.log("TERMINEI SETTLED CANDIDATE")
    const candidateTracks = settledCandidate.filter(
        (r): r is PromiseFulfilledResult<TrackDataLastFm[]> => r.status === "fulfilled"
    
    )
    .flatMap(r => r.value)

    allTracksCandidate.push(...candidateTracks)

    dualMap.set("candidate", allTracksCandidate.length ? allTracksCandidate : [])
    dualMap.set("comparison", allTracksComparison.length ? allTracksComparison : [])

    return {
        type: "dual",
        tracks: dualMap
    }

}


export async function runThroughPages(
    params: ParametersURLInterface,
    dateSource: DateSource
): Promise<TrackDataLastFm[] | CollectedTracksSingle | CollectedTracksDual> {

    const createdParamsList = createParams(params, dateSource)


    const pagesFromType = await runThroughType(createdParamsList)

    if (!pagesFromType) return []

    if (pagesFromType.type === "single") {
        const firstPage = pagesFromType.solo.page

        return await collectPaginatedTracksSingle(firstPage, params, createdParamsList)
    } else {
        // if (pagesFromType.type === "dual" && createdParamsList.type === "dual") {
        console.log("EWNTREI AQUIIIIIIIIIIIIIIIIR ")
        const response = await collectPaginatedTracksDual(
            pagesFromType.dual.candidatePage,
            pagesFromType.dual.comparisonPage,
            params,
            createdParamsList
        )

        return {
            type: response.type,
            tracks: response.tracks
        }
    }
}

// DELETE
export function createURL(
    add: boolean,
    method: string,
    limit: Number,
    userLastFm: string,
    from: number,
    to: number,
    api_key: string,
    page: string,
    format: string,
    createURLOffset = false,
    creationAccountUnixDate?: number,
    percentage?: number,
    windowValueToFetch?: number,
    offset?: number
): string[] {

    const endpoint = "https://ws.audioscrobbler.com/2.0/";
    const endpointEachDay: string[] = [];

    // Dia inicial baseado no "from" original
    let currentStart = unixTimeToUTC(Number(from)).startOf("day");

    for (let i = 0; i < Number(limit); i++) {

        let fromUnix: number;
        let toUnix: number;

        // -----------------------------------------------
        // NORMAL MODE (não usa offset)
        // -----------------------------------------------
        if (!createURLOffset) {

            if (add) {
                fromUnix = currentStart.unix();
                toUnix = currentStart.endOf("day").subtract(59, "seconds").unix();
            } else {
                const day = currentStart.subtract(i, "day");
                fromUnix = day.startOf("day").unix();
                toUnix = day.endOf("day").subtract(59, "seconds").unix();
            }

        } else {
            // -----------------------------------------------
            // OFFSET MODE (usar janela/porcentagem)
            // -----------------------------------------------
            const { fromDate, toDate } = getTracksByAccountPercentage(
                creationAccountUnixDate as number,
                percentage as number,
                windowValueToFetch as number,
                offset as number
            );

            fromUnix = fromDate;
            toUnix = toDate;

            if (offset !== undefined) offset += 1;
        }

        // -----------------------------------------------
        // CRIAÇÃO DOS PARAMS (AGORA com valores corretos)
        // -----------------------------------------------
        const params = new URLSearchParams({
            method,
            limit: "200",
            user: userLastFm,
            from: String(fromUnix),
            to: String(toUnix),
            api_key,
            page: String(page),
            format
        });

        endpointEachDay.push(`${endpoint}?${params.toString()}`);

        // Se for modo "add", avançamos um dia SEM MUTAR o objeto
        if (add) {
            currentStart = currentStart.add(1, "day").startOf("day");
        }
    }

    return endpointEachDay;
}

export function normalizeKeys(oldComparisonTracks: TrackDataLastFm[]) {

    const uniqueKeys = new Set(
        oldComparisonTracks?.map(t =>
            normalize(
                t.name,
                typeof t.artist === "string" ? t.artist : t?.artist["#text"]
            )
        )
    )

    return uniqueKeys
}

export function normalizeTracks(oldComparisonTracks: TrackDataLastFm[]) {
    const normalized: TrackDataLastFm[] = oldComparisonTracks
        .map(t => ({
            ...t,
            key: normalize(
                t.name ?? "",
                (typeof t.artist === "string" ? t.artist : t?.artist["#text"]) ?? ""
            )
        }))

    return normalized
}

export function groupTracksByKey(normalized: TrackDataLastFm[], uniqueKeys: Set<string>) {
    const grouped = new Map<string, TrackDataLastFm[]>()

    for (const track of normalized) {


        if (!uniqueKeys.has(track.key)) {
            continue
        }

        if (!grouped.has(track.key)) {
            grouped.set(track.key, [])
        }

        grouped.get(track.key)!.push(track)
    }

    return grouped
}

export function getLatestTracks(grouped: Map<string, TrackDataLastFm[]>, fetchInDays?: number) {

    const latestTracks = new Map<string, TrackDataLastFm>()


    for (const [key, tracks] of grouped.entries()) {

        //let daysWithoutListening = fetchInDays

        //REVISAR

        // if (this.timeLoopHasRun != 0) {
        //     daysWithoutListening += this.fetchInDays
        // }

        const valid = tracks.filter(x => x.date?.uts && !isNaN(Number(x.date?.uts)))
        if (valid.length === 0) continue


        const greatest = Math.max(...valid.map((t) => Number(t.date?.uts)))

        const latest = valid.find(t => Number(t.date?.uts) === greatest)

        if (latest) latestTracks.set(key, latest)
    }

    return latestTracks

}


export async function getPlaycountOfTrack(user: LastFmFullProfile | string, musicName: string, artistName: string) {

    const endpoint = "https://ws.audioscrobbler.com/2.0/";
    const params = {
        method: "track.getInfo",
        user: typeof user === "string" ? user : user.name,
        track: musicName,
        artist: artistName,
        format: "json",
        api_key: process.env.LAST_FM_API_KEY!,
        limit: "0"
    }

    const response = await safeAxiosGet<TrackWithPlaycount>(endpoint, params)

    const userPlaycount = response?.track?.userplaycount ?? "0";
    return userPlaycount
}
