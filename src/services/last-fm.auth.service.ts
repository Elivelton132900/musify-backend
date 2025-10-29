import axios from "axios"
import { ParamsHash } from "../models/last-fm.auth.model"
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

    async getUserInfo(api_key: string, user: string) {
        const endpoint = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=rj&api_key=${api_key}&format=json`

        const response = await axios.get(endpoint, {
            params: {
                user,
                api_key
            }
        })

        return response.data
    }

}