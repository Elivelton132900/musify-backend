import { TimeRange } from './../types';
import axios from "axios";
//import { SpotifyRepository } from "../repositories/spotify.repository";

export class SpotifyService {


    //private spotifyRepository: SpotifyRepository;

    //constructor() {
    //    this.spotifyRepository = new SpotifyRepository()
    //}


    async getTopMusics(access_token: string) {

        const endPoint = `https://api.spotify.com/v1/me/top/tracks?time_range=${TimeRange.medium}&limit=1`
        const response = await axios.get(endPoint, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        })

        return response.data.items
    }
}