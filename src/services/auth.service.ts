import axios from "axios"

export class AuthService {

    constructor(){}

    async auth(auth: string) {
        try {
            const response = await axios.post(
                "https://accounts.spotify.com/api/token",
                "grant_type=client_credentials",
                {
                    headers: {
                        "Authorization": `basic ${auth}`,
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            )
            const data = response.data
            console.log(data)
        } catch(err) {
            console.log(err)
        }
    }
}