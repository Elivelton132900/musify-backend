import { ParamsHash } from "../models/model.last-fm"
import crypto from "crypto"

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