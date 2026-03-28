import { SpotifyTrackAPI, TimeRange, TrackDataSpotify } from './../models/spotify.model';
import { SpotifyFullReturnAPI } from '../models/spotify.model';
import axios from "axios";
import { SpotifyMapper } from '../utils/spotifyMapper';
import { compareRanges } from '../utils/spotifyUtils';
import { redis } from '../infra/redis';

//  SE TIVER UM RANGE SENDO BUSCADO, JÁ TENDO O RESULTADO NO REDIS, NÃO BUSCAR NOVAMENTE, E SIM RETORNAR O VALOR JÁ SALVO
// DIMINUIR INFORMACOES SENDO SALVAS PARA PESAR MENOS long term 28mb - medium term 16mb -> UTILIZAR HASH
export class SpotifyService {



    async fetchTopMusics(access_token: string, time_range: TimeRange) {

        const items: SpotifyTrackAPI[] = []

        const endpoint = `https://api.spotify.com/v1/me/top/tracks?time_range=${time_range}&limit=50`
        const response = await axios.get<SpotifyFullReturnAPI>(endpoint, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        })
        console.log(response.data.total, response.data.offset)
        items.push(...response.data.items)

        let next = response.data.next
        let isThereNext = typeof next === "string" && next.includes("https://api.spotify.com/v1/me/top/tracks?")

        if (isThereNext) {
            while (isThereNext && next) {
                
                const endpoint = next
                const response = await axios.get<SpotifyFullReturnAPI>(endpoint, {
                    headers: {
                        Authorization: `Bearer ${access_token}`
                    }
                })
                console.log(next, response.data.total, response.data.offset)
                items.push(...response.data.items)

                next = response.data.next
                isThereNext = typeof next === "string" && next.includes("https://api.spotify.com/v1/me/top/tracks?")
            }
        }

        return items
    }

    async syncTopMusics(access_token: string, spotifyId: string, time_range: TimeRange) {

        const time_range_redis = await redis.get(`${spotifyId}:${time_range}`)
        if (!time_range_redis) {
            const topMusics = await this.fetchTopMusics(access_token, time_range)
            await redis.set(`${spotifyId}:${time_range}`, JSON.stringify(topMusics), "EX", 60 * 60 * 24)
            const topMusicsMapped = topMusics.map((track) => SpotifyMapper.toTrackData(track))
            return topMusicsMapped
        }
        return time_range_redis
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
        } else if (comparingShortAndMedium) {
            await Promise.all([
                this.syncTopMusics(access_token, spotifyId, TimeRange.medium),
                this.syncTopMusics(access_token, spotifyId, TimeRange.short),

            ])
        } else { // comparing Long Medium
            await Promise.all([
                this.syncTopMusics(access_token, spotifyId, TimeRange.long),
                this.syncTopMusics(access_token, spotifyId, TimeRange.medium)
            ])
        }
    }

    async getTracksTimeRange(spotifyId: string, time_range: TimeRange) {
        const rawTracks = await redis.get(`${spotifyId}:${time_range}`)
        if (!rawTracks) {
            return null
        }

        return JSON.parse(rawTracks).map((track: SpotifyTrackAPI) => SpotifyMapper.toTrackData(track)) as SpotifyTrackAPI[]
        // const rawTracks = await this.spotifyRepository.getTracksTimeRange(spotifyId, time_range)
        // if (!rawTracks) return null

        // return rawTracks.map((track) => SpotifyMapper.toTrackData(track))

    }

    async compareRanges(spotifyId: string, compareTimeRange: { firstCompare: TimeRange, secondCompare: TimeRange }) {

        const { firstCompare, secondCompare } = compareTimeRange

        const firstRange = await redis.get(`${spotifyId}:${firstCompare}`)
        const secondRange = await redis.get(`${spotifyId}:${secondCompare}`)

        if (!firstRange || !secondRange) {
            return
        }

        const firstRangeArray = JSON.parse(firstRange) as SpotifyTrackAPI[]
        const secondRangeArray = JSON.parse(secondRange) as SpotifyTrackAPI[]
        const mappedFirstRange: TrackDataSpotify[] = firstRangeArray.map((track: SpotifyTrackAPI) => SpotifyMapper.toTrackData(track))
        const mappedSecondRange: TrackDataSpotify[] = secondRangeArray.map((track: SpotifyTrackAPI) => SpotifyMapper.toTrackData(track))
        // const firstRange = (await this.spotifyRepository.getTracksTimeRange(spotifyId, firstCompare)) 
        //     ?.map((track) => SpotifyMapper.toTrackData(track)) || []

        // const secondRange = (await this.spotifyRepository.getTracksTimeRange(spotifyId,  secondCompare))
        //     ?.map((track) => SpotifyMapper.toTrackData(track)) || []

        return compareRanges(mappedFirstRange, mappedSecondRange)

    }

    async syncAndCompare(access_token: string, spotifyId: string, compareTimeRange: { firstCompare: TimeRange, secondCompare: TimeRange }) {
        await this.syncAllTopMusics(access_token, spotifyId, compareTimeRange)
        return this.compareRanges(spotifyId, compareTimeRange)
    }

}