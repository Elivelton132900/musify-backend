import axios from "axios"
import { LastFmFullProfile, ParamsHash } from "../models/last-fm.auth.model"
import { createHash } from "../utils/lastFmUtils"
import { AuthLastFmRepository } from "../repositories/auth.last-fm.repository"

export class LastFmService {

    private authLastFmRepository: AuthLastFmRepository

    constructor() {
        this.authLastFmRepository = new AuthLastFmRepository()
    }

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

    async saveFullProfileInfo(fullProfile: LastFmFullProfile) {
        await this.authLastFmRepository.saveFullProfileInfo(fullProfile)
    }

}