import axios from "axios"

export class LastFmService {

    async getTopTracks(limit: number, user: string) {
        const endpoint = "https://ws.audioscrobbler.com/2.0/"

        const api_key = process.env.LAST_FM_API_KEY
        const response = await axios.get(endpoint, {
            params: {
                method: "user.gettoptracks",
                api_key,
                format: "json",
                user,
                limit,
                period: "overall"
            }
        })

        return response.data
    }

}