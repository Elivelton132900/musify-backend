import { ParamsHash } from "../models/last-fm.auth.model"
import crypto from "crypto"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';
import { Params, TrackDataLastFm } from "../models/last-fm.model";
import axios, { AxiosResponse } from "axios";
import { AxiosError } from "axios";


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

export function deleteDuplicate(tracks: TrackDataLastFm[]) {
    const setRemoveDuplicates = new Set()
    const uniqueRegisters: TrackDataLastFm[] = []

    if (!tracks || tracks.length === 0) return []

    for (const track of tracks) {
        const url = (track.url ?? "").trim().toLowerCase();
        const artist =
            (typeof track.artist === "string"
                ? track.artist
                : track.artist?.["#text"] ?? ""
            ).trim().toLowerCase();

        const key = `${url}-${artist}`

        if (!setRemoveDuplicates.has(key)) {
            setRemoveDuplicates.add(key)
            uniqueRegisters.push(track)
        }
    }

    return uniqueRegisters;
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
        .normalize("NFKC")
        .replace(/[\u00A0\u200B\uFEFF]/g, " ") // remove NBSP, ZWSP e BOM
        .replace(/\s+/g, " ") // uniformiza espaços múltiplos
        .trim()
}

export const cleanUnmatchedPercentages = (tracks: TrackDataLastFm[], numberScrobbles: number): TrackDataLastFm[] => {
    const cleanedTrackData = tracks.filter((t) => Number(t.userplaycount) >= numberScrobbles && Number(t.userplaycount) <= numberScrobbles + 200)
    return cleanedTrackData
}

export const cleanRecentlyPlayed = (tracks: TrackDataLastFm[]): TrackDataLastFm[] => {
    const dateToday = dayjs().utc()

    return tracks.filter((t) => {
        const dateBase = unixTimeToUTC(Number(t.date.uts))
        return dateToday.isAfter(dateBase.add(10, "day"))
    })

}

interface safeAxiosOptions {
    retries?: number,
    delay?: number,
    silent?: boolean
}

export async function safeAxiosGet<T>(
    url: string,
    params?: Params,
    options?: safeAxiosOptions,
): Promise<T | null> {
    const { retries = 3, delay = 2000, silent = false } = options || {}

    for (let attempt = 0; attempt <= retries; attempt++) {
        let response: AxiosResponse<T>
        try {
            if (!params) {
                response = await axios.get(url)
            } else {
                response = await axios.get(url, {
                    params: params
                })
            }


            const data = response.data as any

            if (data?.error) {
                if (!silent) {
                    console.warn(
                        `⚠️ Last.fm retornou erro ${data.error}: ${data.message} (URL: ${url})`
                    )
                }

                if ((data.error === 8 || data.error === 29) && attempt < retries) {
                    await new Promise((r) => setTimeout(r, delay))
                    continue
                }
                return null
            }
            return data
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                if (!silent) {
                    console.error(
                        `🚨 Falha Axios (${error.response?.status ?? "sem status"}):`,
                        error.response?.data?.message ?? error.message
                    )
                }

                if (
                    (error.response?.status === 500 || error.response?.status === 502) &&
                    attempt < retries
                ) {
                    await new Promise((r) => setTimeout(r, delay))
                    continue
                }
            } else {
                if (!silent) console.error("Erro inesperado", error)
            }
            return null
        }
    }
    return null
}

export function createURL(
    add: Boolean,
    method: string,
    limit: Number,
    userLastFm: string,
    from: Number,
    to: Number,
    api_key: string,
    page: string,
    format: string,
    createURLOffset = false,
    creationAccountUnixDate?: number,
    percentage?: number,
    windowValueToFetch?: number,
    offset?: number
) {

    const initialStartOfDay = unixTimeToUTC(Number(from)).startOf("day")
    const finalEndOfDay = unixTimeToUTC(Number(to)).endOf("day")

    const endpoint = "https://ws.audioscrobbler.com/2.0/"

    const endpointEachDay = []

    let dataParams = {
        method,
        limit: String(limit),
        user: userLastFm,
        from: String(from),
        to: String(from),
        api_key: process.env.LAST_FM_API_KEY as string,
        page: String(1),
        format: "json"
    }

    for (let i = 1; i < Number(limit); i++) {

        dataParams = { ...dataParams, from: String(from), to: String(to) }

        const params = new URLSearchParams(dataParams)

        if (!createURLOffset) {
            from = add
                ?
                initialStartOfDay.add(1, 'day').startOf('day').unix()
                :
                initialStartOfDay.subtract(i - 1, 'day').startOf('day').unix()
            to = add
                ?
                finalEndOfDay.add(1, 'day').endOf('day').unix()
                :
                finalEndOfDay.subtract(i - 1, 'day').endOf('day').unix()

        } else {
            const { fromDate, toDate } = getTracksByAccountPercentage(
                creationAccountUnixDate as number,
                percentage as number,
                windowValueToFetch as number,
                offset as number
            )

            dataParams = { ...dataParams, from: String(fromDate), to: String(toDate) }
            from = add
                ?
                initialStartOfDay.add(1, 'day').startOf('day').unix()
                :
                initialStartOfDay.subtract(i - 1, 'day').startOf('day').unix()
            to = add
                ?
                finalEndOfDay.add(1, 'day').endOf('day').unix()
                :
                finalEndOfDay.subtract(i - 1, 'day').endOf('day').unix()

                if (offset) {
                    offset += 1
                }
                

        }

        const finalizedEnpoint = `${endpoint}?${params.toString()}`
        endpointEachDay.push(finalizedEnpoint)

    }

    return endpointEachDay
}