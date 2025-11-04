import { TrackDataLastFm, SearchFor } from "../models/last-fm.model"
import { deleteDuplicate, getForgottenTracks } from "../utils/lastFmUtils"
import { LastFmFetcherService } from "./last-fm-fetcher.service"
import { LastFmRepository } from "../repositories/last-fm.repository"
import { LastFmFullProfile } from "../models/last-fm.auth.model"


export class LastFmLogicService {


    private readonly fetcher: LastFmFetcherService
    private readonly repository: LastFmRepository

    constructor() {
        this.repository = new LastFmRepository()
        this.fetcher = new LastFmFetcherService()
    }

    async getUserByUsername(userLastFm: string): Promise<LastFmFullProfile> {
        const user = await this.repository.getUserByName(userLastFm)
        return new LastFmFullProfile(user)
    }

    async fetchUntilUniqueLimit(
        initialTracks: TrackDataLastFm[],
        user: string,
        limit: number,
        percentage: number
    ) {

        const userFullProfile = await this.getUserByUsername(user) as LastFmFullProfile
        let uniques: TrackDataLastFm[] = deleteDuplicate(initialTracks)
        const existingKeys = new Set(
            uniques.map(t => `${t.name.trim().toLowerCase()}-${t.artist.trim().toLowerCase()}`)
        )
        if (uniques.length >= limit) {
            return deleteDuplicate(initialTracks).slice(0, limit)
        }

        let windowValueToFetch = 10
        let offset = 0

        const limitToFetch = "25"
        const topTracksAllTime = await this.fetcher.getTopTracksAllTime(user, limitToFetch)
        let keys: string[] = []
        topTracksAllTime.toptracks.track.map((t) => {
            const key = t.name.trim().toLowerCase() + "-" + t.artist.name.trim().toLowerCase()
            keys.push(key)
        })

        const recentTracks = await this.fetcher.getTracksByPercentage(percentage, userFullProfile, limit, windowValueToFetch, offset)
        let timesTriedToFetchNewMusics = 0



        while (uniques.length <= limit) {
            offset += windowValueToFetch;

            if (uniques.length >= limit) {
                return uniques.slice(0, limit)
            }

            const remainingLimit = limit - uniques.length
            const oldTracks = await this.fetcher.getTracksByPercentage(percentage, userFullProfile, remainingLimit, windowValueToFetch, offset)
            const moreTracks = getForgottenTracks(oldTracks, recentTracks)

            const mixed = [...moreTracks, ...initialTracks]


            const mixedDeletedDuplicate = deleteDuplicate(mixed)


            const newTracks = mixedDeletedDuplicate.filter(track => {
                const key = `${track.name.trim().toLowerCase()}-${track.artist.trim().toLowerCase()}`
                if (existingKeys.has(key)) return false
                existingKeys.add(key)
                return true
            })

            uniques.push(...newTracks)


            if (newTracks.length === 0) {
                timesTriedToFetchNewMusics += 1
                // se não achou nada novo, aumenta o intervalo
                windowValueToFetch = Math.ceil(windowValueToFetch * 1.7);
                if (timesTriedToFetchNewMusics === 15) {
                    break
                }
            }

            uniques = uniques.filter((t) => {
                const key = t.name.trim().toLowerCase() + "-" + t.artist.trim().toLowerCase()
                return !keys.includes(key)
            })


            if (uniques.length >= limit) break

            uniques.slice(0, limit)
        }

        return uniques.sort((a, b) => Number(b.userplaycount) - Number(a.userplaycount))

    }


    rediscover(oldTracks: TrackDataLastFm[], recentTracks: TrackDataLastFm[]) {


        const rediscover = getForgottenTracks(oldTracks, recentTracks)

        return rediscover
    }



    async resolveRediscoverList(percentageSearchFor: string, userLastFm: string, limit: number): Promise<TrackDataLastFm[]> {
        const percentageSearchForNumber = SearchFor[percentageSearchFor as keyof typeof SearchFor]
        const user = await this.getUserByUsername(userLastFm)

        const resultOldSearchFor = await this.fetcher.getTopOldTracksPercentage(user, percentageSearchForNumber, limit)


        const recentYears = await this.fetcher.getTopRecentTrack(user, percentageSearchForNumber, limit)


        const rediscover = this.rediscover(resultOldSearchFor, recentYears)
        const clearedDuplicates = deleteDuplicate(rediscover)
        console.log("\n\ncleared: \n\n", clearedDuplicates)
        if (clearedDuplicates.length < Number(limit)) {
            console.log("entrei \n")
            return await this.fetchUntilUniqueLimit(clearedDuplicates, userLastFm, Number(limit), Number(percentageSearchForNumber))
        }
        return clearedDuplicates
    }


}