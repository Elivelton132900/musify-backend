import { ParamsHash } from "../models/last-fm.auth.model"
import crypto from "crypto"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';
import { Params, TrackDataLastFm } from "../models/last-fm.model";
import axios from "axios";
import { AxiosError } from "axios";
import { Agent as HttpsAgent } from "https";
import { Agent as HttpAgent } from "http";


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

export function deleteDuplicateKeepLatest(tracks: TrackDataLastFm[]): TrackDataLastFm[] {
    const groups = new Map<string, TrackDataLastFm[]>()

    for (const track of tracks) {
        if (!track) {
            console.log("Track undefined!!!", track);
            continue
        }
        if (!track.artist) {
            console.log("Track sem artist:", track);
        }

        const artist = typeof track?.artist === "string" ? track.artist : track.artist?.["#text"] ?? ""

        const key = normalize(track.name, artist)

        if (!groups.has(key)) {
            groups.set(key, [])
        }

        groups.get(key)!.push(track)
    }

    let results: TrackDataLastFm[] = []

    for (const [_key, tracks] of groups) {
        const greatestUts = Math.max(...tracks.map(a =>
            Number(a.date.uts)
        ))


        // not listened in 
        const greatestRegister = tracks.find(a => Number(a.date.uts) === greatestUts)!
        results.push(greatestRegister)
    }

    return results
}

function latestTracksListened(recentTracks: TrackDataLastFm[], oldTracks: TrackDataLastFm[]) {

    const tracks = [...recentTracks, ...oldTracks]
    console.log("tracks> ", tracks.length)
    const seenKeys = new Set<string>()
    const latestMap: Record<string, TrackDataLastFm> = {}

    for (const track of tracks) {
        const key = normalize(track.name, track.artist)

        if (!seenKeys.has(key)) {
            seenKeys.add(key)
            latestMap[key] = track
        } else if (Number(track?.date?.uts) > Number(latestMap[key]?.date?.uts)) {
            latestMap[key] = track
        }
    }
    return Object.values(latestMap)
}


export function deleteTracksNotInRange(rangeDays: number, recentTracks: TrackDataLastFm[], oldTracks: TrackDataLastFm[]): TrackDataLastFm[] {

    const tracks = latestTracksListened(recentTracks, oldTracks)
    const limitDate = dayjs().subtract(rangeDays, "days").utc().unix()
    const groups = new Map<string, TrackDataLastFm>()

    for (const track of tracks) {
        const artist = typeof track.artist === "string"
            ? track.artist
            : track.artist['#text']

        const key = normalize(track.name, artist)
        const uts = Number(track.date.uts)
        if (isNaN(uts)) continue


        if (track.name === "the grudge") {
            console.log("track\n", track)
        }

        const current = groups.get(key)
        if (!current || uts > Number(current.date.uts)) {
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
    return [...groups.values()].filter(track => Number(track.date.uts) <= limitDate)
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

// export function deleteDuplicate(tracks: TrackDataLastFm[]) {
//     const setRemoveDuplicates = new Set()
//     const uniqueRegisters: TrackDataLastFm[] = []

//     if (!tracks || tracks.length === 0) return []

//     for (const track of tracks) {
//         const artist =
//             (typeof track.artist === "string"
//                 ? track.artist
//                 : track.artist?.["#text"] ?? ""
//             ).trim().toLowerCase();

//         const key = normalize(track.name, artist)

//         if (!setRemoveDuplicates.has(key)) {
//             setRemoveDuplicates.add(key)
//             uniqueRegisters.push(track)
//         }
//     }

//     return uniqueRegisters;
// }
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
    params?: Params,
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