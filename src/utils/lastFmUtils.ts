import 'dotenv/config';
import { DateSource, DatesURLQueyParam, ParamsBySource, RunThroughTypeResult, FetchPageResultSingle, TrackDataLastFm, CollectedTracksSingle, CollectedTracksDual, TrackWithPlaycount, RecentTracks } from './../models/last-fm.model';
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

dayjs.extend(utc)

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

export function deleteDuplicateKeepLatest<T extends { name: string; artist: string; date: { uts?: string | number } }>(
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
export function deleteTracksNotInRange<T extends {
    name: string,
    artist: string,
    date: { uts?: string | number; "#text"?: string }
}>(
    rangeDays: number,
    recentTracks: T[],
    oldTracks: T[]
): T[] {

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
        const daysWithoutListening = dayjs().utc().diff(dayjs.unix(Number(updated?.date.uts)).utc().startOf("day"), "day")

        if (daysWithoutListening > rangeDays) {
            const updatedTrack = { ...updated! }
            updatedTrack.date!["#text"] = `Not listened during the analyzed period (${rangeDays} days`
            groups.set(key, updatedTrack)

        }
    }
    return [...groups.values()].filter(track => Number(track.date?.uts) <= limitDate)
}

export function distinctArtists(alltracks: TrackDataLastFm[], maximumRepetition: number, order: string, limit: number): TrackDataLastFm[] {

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

        if (mapDistincted.size >= limit) {
            break
        }

    }


    return Array.from(mapDistincted.values()).flat()
}

export function deleteTracksUserPlaycount(minimumScrobbles: number, allTracks: TrackDataLastFm[], maximumScrobbles: boolean | number): TrackDataLastFm[] {
    if (typeof maximumScrobbles === 'number') {
        return allTracks.filter((track) => {
            return Number(track?.userplaycount) >= minimumScrobbles && Number(track?.userplaycount) < maximumScrobbles
        })
    } else {
        return allTracks.filter((track) => {
            return Number(track?.userplaycount) >= minimumScrobbles
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
    silent?: boolean,
    signal: AbortSignal
}

const http = axios.create({
    timeout: 15000,
    httpAgent: new HttpAgent({ keepAlive: true, maxSockets: 16 }),
    httpsAgent: new HttpsAgent({ keepAlive: true, maxSockets: 16 })

})

export function isRetryableAxiosError(error: unknown): boolean {
    if (!(error instanceof AxiosError)) return false;

    const isTimeout =
        error.code === "ECONNABORTED" ||
        error.message.toLowerCase().includes("timeout");

    const retryableStatus = [500, 502, 503, 504];
    const isRetryableStatus =
        retryableStatus.includes(error.response?.status ?? 0);

    return isTimeout || isRetryableStatus;
}

function abortableDelay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {

        // Se já estiver abortado, nem começa
        if (signal?.aborted) {
            return reject(new Error("Aborted"))
        }

        const timeout = setTimeout(resolve, ms)

        // Se abortar durante o delay
        signal?.addEventListener("abort", () => {
            clearTimeout(timeout)
            reject(new Error("Aborted during delay"))
        })
    })
}

export async function safeAxiosGet<T>(
    url: string,
    params?: ParametersURLInterface,
    options?: safeAxiosOptions,
): Promise<T | null> {



    const { retries = 3, delay = 10000, silent = false, signal } = options || {}

    for (let attempt = 0; attempt <= retries; attempt++) {

        if (signal?.aborted) {
            throw new Error("Request Aborted")
        }

        try {
            const response = await http.get<T>(url, { params })
            const data: any = response.data

            if (data?.error) {
                if (!silent) console.warn("Last FM erro: ", data.error, data.message)

                if ([8].includes(data.error) && attempt < retries) {
                    await abortableDelay(delay, signal)
                    // await new Promise(r => setTimeout(r, delay))
                    continue
                    // rate limit exceeded
                } else if ([29].includes(data.error) && attempt < retries) {
                    await abortableDelay(delay, signal)
                    // await new Promise(r => setTimeout(r, 15000))
                }
                return null
            }
            return data as T
        } catch (e: unknown) {
            const error = e as AxiosError
            const retryable = isRetryableAxiosError(error);
            if (retryable && !silent) {
                console.warn("Retryable Axios error:", {
                    code: error.code,
                    status: error.response?.status,
                    url: error.config?.url
                });
            }
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
                await abortableDelay(delay, signal)
                // await new Promise(r => setTimeout(r, delay));
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

        console.log("DATEEEEEEEEEEEEEES: ", startDayFromComparison, "", endDayToComparison, "", startDayFromCandidate, "", endDayToCandidate)
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

export async function fetchPageSingle(
    signal: AbortSignal,
    params: ParametersURLInterface
): Promise<FetchPageResultSingle | null> {

    const endpoint = "https://ws.audioscrobbler.com/2.0/"
    const response = await safeAxiosGet<RecentTracks>(endpoint, params, { signal })

    if (!response?.recenttracks) return null

    return {
        tracks: normalizeRecentTracks(response.recenttracks.track),
        pagination: {
            page: Number(response.recenttracks["@attr"]?.page),
            totalPages: Number(response.recenttracks["@attr"]?.totalPages)
        }
    }
}

async function runThroughType(signal: AbortSignal, createdParamsList: ParamsBySource): Promise<RunThroughTypeResult | null> {


    if (createdParamsList.type !== "dual") return null

    const candidateFirst = await fetchPageSingle(
        signal,
        createdParamsList.candidate[0]
    )

    const comparisonFirst = await fetchPageSingle(
        signal,
        createdParamsList.comparison[0]
    )

    if (!candidateFirst || !comparisonFirst) return null

    return {
        type: "dual",
        dual: {
            candidatePage: candidateFirst,
            comparisonPage: comparisonFirst
        }
    }
}
async function collectPaginatedTracksSingle(
    firstPage: FetchPageResultSingle,
    baseParams: ParametersURLInterface,
    signal: AbortSignal
): Promise<CollectedTracksSingle> {

    const mapSingleTracks = new Map<string, TrackDataLastFm[]>()


    const allTracks: TrackDataLastFm[] = [...firstPage.tracks]

    const limitConcurrency = pLimit(15)

    const tasks: Promise<void>[] = []

    for (let page = 2; page <= firstPage.pagination.totalPages; page++) {

        if (signal.aborted) {
            break
        }

        console.log("collectpaginatedtrackssingle page", page)
        tasks.push(
            limitConcurrency(async () => {

                if (signal.aborted) return

                const data = await fetchPageSingle(
                    signal,
                    { ...baseParams, page: String(page) },
                )

                if (signal.aborted) return

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

export async function runThroughPages(
    params: ParametersURLInterface,
    dateSource: DateSource,
    signal: AbortSignal
): Promise<TrackDataLastFm[] | CollectedTracksSingle | CollectedTracksDual> {

    const createdParamsList = createParams(params, dateSource)


    const pagesFromType = await runThroughType(signal, createdParamsList)

    if (!pagesFromType) return []

    if (pagesFromType.type === "single") {
        const firstPage = pagesFromType.solo.page

        return await collectPaginatedTracksSingle(firstPage, params, signal)
    }

    if (pagesFromType.type === "dual" && createdParamsList.type === "dual") {

        const candidateBase = createdParamsList.candidate[0]
        console.log("CANDIDATE BASE>: ", candidateBase, "\n\n\n")
        console.log("createdparamslist ", createdParamsList)
        const comparisonBase = createdParamsList.comparison[0]
        console.log("")
        const [candidateCollected, comparisonCollected] = await Promise.all([
            collectPaginatedTracksSingle(
                pagesFromType.dual.candidatePage,
                candidateBase,
                signal
            ),
            collectPaginatedTracksSingle(
                pagesFromType.dual.comparisonPage,
                comparisonBase,
                signal
            )
        ])

        console.log("TERMINEI O PROMISE ALL")

        return {
            type: "dual",
            tracks: new Map<string, TrackDataLastFm[]>([
                ["candidate", candidateCollected.tracks.get("singleTracks") ?? []],
                ["comparison", comparisonCollected.tracks.get("singleTracks") ?? []]
            ])
        }
    }

    return []

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

        const valid = tracks.filter(x => x.date?.uts && !isNaN(Number(x.date?.uts)))
        if (valid.length === 0) continue


        const greatest = Math.max(...valid.map((t) => Number(t.date?.uts)))

        const latest = valid.find(t => Number(t.date?.uts) === greatest)

        if (latest) latestTracks.set(key, latest)
    }

    return latestTracks

}


export async function getPlaycountOfTrack(signal: AbortSignal, user: LastFmFullProfile | string, musicName: string, artistName: string) {

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

    const response = await safeAxiosGet<TrackWithPlaycount>(endpoint, params, { signal })

    const userPlaycount = response?.track?.userplaycount ?? "0";
    return userPlaycount
}


interface BuildRediscoverCacheKeyInterface {
    candidateFrom: string,
    candidateTo: string,
    comparisonFrom: string,
    comparisonTo: string,
    distinct: undefined | number,
    fetchInDays: number,
    maximumScrobbles: undefined | number,
    minimumScrobbles: number
}

export function buildRediscoverCacheKey(
    username: string,
    params: BuildRediscoverCacheKeyInterface
) {
    const normalized = {
        candidateFrom: params.candidateFrom,
        candidateTo: params.candidateTo,
        comparisonFrom: params.comparisonFrom,
        comparisonTo: params.comparisonTo
    }

    const hash = crypto
        .createHash("sha1")
        .update(JSON.stringify(normalized))
        .digest("hex")
    console.log("HASH   - - - - ", hash)
    return `rediscover:result:${username}:${hash}`
}

export function buildCacheKey(user: string, hash: string) {
    return `rediscover:result:${user}:${hash}`
}

export function buildLockKey(user: string, hash: string) {
    return `rediscover:lock:${user}:${hash}`
}