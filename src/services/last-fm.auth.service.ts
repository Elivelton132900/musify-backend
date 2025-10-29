import axios from "axios"
import { ParamsHash } from "../models/model.last-fm"
import { createHash } from "../utils/lastFmUtils"

export class LastFmService {

    async getSession(token: string, api_key: string) {

        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const params: ParamsHash = {
            api_key,
            method: "auth.getSession",
            token
        }

        const api_sig = createHash(params)

        const response = await axios.get(endpoint, {
            params: {
                method: params.method,
                token,
                api_key,
                api_sig,
                format: "json"
            }
        })


        return response.data
    }

}