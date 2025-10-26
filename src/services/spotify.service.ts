import { SpotifyFullReturnAPI } from '../models/spotify.model';
import { TimeRange } from './../types';
import axios from "axios";
import { SpotifyRepository } from "../repositories/spotify.repository";



export class SpotifyService {


    private spotifyRepository: SpotifyRepository;

    constructor() {
        this.spotifyRepository = new SpotifyRepository()
    }

    async fetchTopMusics(access_token: string, time_range: TimeRange) {

        const endpoint = `https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=1`
        const response = await axios.get(endpoint, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        })

        return response.data as SpotifyFullReturnAPI
    }

    async syncTopMusics(access_token: string, spotifyId: string, time_range: TimeRange) {

        const topMusics = await this.fetchTopMusics(access_token, time_range)
        await this.spotifyRepository.saveTimeRangeTracksSpotify(topMusics, spotifyId, time_range)
    }

    async syncAllTopMusics(access_token: string, spotifyId: string) {
        await Promise.all([
            this.syncTopMusics(access_token, spotifyId, TimeRange.long),
            this.syncTopMusics(access_token, spotifyId, TimeRange.medium),
            this.syncTopMusics(access_token, spotifyId, TimeRange.short),
        ])
    }

    async compareLongToShort(spotifyId: string) {
        this.spotifyRepository.compareLongToShort(spotifyId)

    }

}