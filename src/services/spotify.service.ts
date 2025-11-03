import { TimeRange } from './../models/spotify.model';
import { SpotifyFullReturnAPI } from '../models/spotify.model';
import axios from "axios";
import { SpotifyRepository } from "../repositories/spotify.repository";
import { SpotifyMapper } from '../utils/spotifyMapper';
import { compareRanges } from '../utils/spotifyUtils';


export class SpotifyService {


    private spotifyRepository: SpotifyRepository;

    constructor() {
        this.spotifyRepository = new SpotifyRepository()
    }

    async fetchTopMusics(access_token: string, time_range: TimeRange) {

        const endpoint = `https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=10`
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
        return topMusics.items.map((track) => SpotifyMapper.toTrackData(track))
    }

    async syncAllTopMusics(access_token: string, spotifyId: string, compareTimeRange: { firstCompare: TimeRange, secondCompare: TimeRange }) {

        const { firstCompare, secondCompare } = compareTimeRange

        const comparingShortAndMedium = (firstCompare === TimeRange.medium && secondCompare === TimeRange.short) 
        || (firstCompare === TimeRange.short && secondCompare === TimeRange.medium) 

        const comparingShortAndLong = (firstCompare === TimeRange.long && secondCompare === TimeRange.short) ||
        (firstCompare === TimeRange.short && secondCompare === TimeRange.long)

        if (comparingShortAndLong) {
            await Promise.all([
                this.syncTopMusics(access_token, spotifyId, TimeRange.long),
                this.syncTopMusics(access_token, spotifyId, TimeRange.short),

            ])
        } else if (comparingShortAndMedium ){
            await Promise.all([
                this.syncTopMusics(access_token, spotifyId, TimeRange.medium),
                this.syncTopMusics(access_token, spotifyId, TimeRange.short),

            ])
        }
    }

    async getTracksTimeRange(spotifyId: string, time_range: TimeRange) {
        const rawTracks = await this.spotifyRepository.getTracksTimeRange(spotifyId, time_range)
        if (!rawTracks) return null

        return rawTracks.map((track) => SpotifyMapper.toTrackData(track))

    }

    async compareRanges(spotifyId: string, compareTimeRange: { firstCompare: TimeRange, secondCompare: TimeRange }) {

        const { firstCompare, secondCompare } = compareTimeRange

        const firstRange = (await this.spotifyRepository.getTracksTimeRange(spotifyId, firstCompare))
            ?.map((track) => SpotifyMapper.toTrackData(track)) || []

        const secondRange = (await this.spotifyRepository.getTracksTimeRange(spotifyId, secondCompare))
            ?.map((track) => SpotifyMapper.toTrackData(track)) || []

        return compareRanges(firstRange, secondRange)

    }

    async syncAndCompare(access_token: string, spotifyId: string, compareTimeRange: { firstCompare: TimeRange, secondCompare: TimeRange }) {
        await this.syncAllTopMusics(access_token, spotifyId, compareTimeRange)
        return this.compareRanges(spotifyId, compareTimeRange)
    }

}