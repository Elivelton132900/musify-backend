import { ParamsHash } from "../models/last-fm.auth.model"
import crypto from "crypto"
import dayjs from "dayjs"
import utc from 'dayjs/plugin/utc';


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

export function getTracksByAccountPercentage(accountCreationUnixTime: string, percentage: number) {
    const creationDate = unixTimeToUTC(accountCreationUnixTime)
    const now = dayjs().utc()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const totalLifeSeconds = now.unix() - creationDate.unix()

    // Calcula o total de segundos que se passaram desde a criação da conta até agora
    const secondsToPoint = totalLifeSeconds * (percentage / 100)

    // Soma esses segundos à data de criação para obter o ponto exato no tempo (data inicial)


    // Define uma janela de tempo de 10 dias a partir desse ponto (data final)
    // Serve para buscar faixas tocadas nesse intervalo
    const fromDate = creationDate.add(secondsToPoint, "second");
    const toDate = fromDate.add(10, "day"); // janela de 10 dias (pode ajustar)

    return { fromDate, toDate }

}