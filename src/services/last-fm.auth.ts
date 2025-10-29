import { ParamsHashMD5GetSession } from "../models/model.last-fm"
import { createHash } from "../utils/lastFmUtils"

export class LastFmService {

    async getSession(token: string, api_key: string, api_secret: string) {
        const params: ParamsHashMD5GetSession = {
            api_key,
            method: "auth.getSession",
            token
        }

        const sig = createHash(params)
        console.log("sig: ", sig, sig.length)
    }

}