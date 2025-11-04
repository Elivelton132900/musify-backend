import { ParamsHash } from "../models/last-fm.auth.model"
import crypto from "crypto"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';
import { TrackDataLastFm } from "../models/last-fm.model";


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

export function unixTimeToUTC(unixtime: string) {
    dayjs.extend(utc);

    const utcDateTime = dayjs.unix(Number(unixtime)).utc()

    return utcDateTime

}

export function getTracksByAccountPercentage(
    accountCreationUnixTime: string,
    percentage: number,
    windowValueToFetch: number,
    offset: number
) {



    const creationDate = unixTimeToUTC(accountCreationUnixTime)
    const now = dayjs().utc()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const totalLifeSeconds = now.unix() - creationDate.unix()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const secondsToPoint = totalLifeSeconds * (percentage / 100)

    // ponto de início da janela, com deslocamento em dias


    // ponto de início da janela, com deslocamento em dias
    const fromDate = creationDate
        .add(secondsToPoint, "second")
        .add(offset, "day");

    const toDate = fromDate.add(windowValueToFetch, "day"); // janela de x dias (pode ajustar)

    return { fromDate, toDate }

}


export function getForgottenTracks(oldTracks: TrackDataLastFm[], recentTracks: TrackDataLastFm[]) {
    const noMoreListenedTracks = oldTracks.filter((track) => {
        const isStillListened = recentTracks.some((t) =>
            {
            t.name.trim().toLowerCase() + "-" +
            t.artist.trim().toLowerCase() ===
            track.name.trim().toLowerCase() + "-" +
            track.artist.trim().toLowerCase()})
        return !isStillListened
    })


    return noMoreListenedTracks
}

export function deleteDuplicate(tracks: TrackDataLastFm[]) {
    const setRemoveDuplicates = new Set()
    const uniqueRegisters = []

    for (const track of tracks) {
        const key = `${track.name.trim().toLowerCase()}-${track.artist.trim().toLowerCase()}`
        if (!setRemoveDuplicates.has(key)) {
            setRemoveDuplicates.add(key)
            uniqueRegisters.push(track)
        }
    }

    return uniqueRegisters
}