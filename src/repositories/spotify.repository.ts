import { CollectionReference, getFirestore } from "firebase-admin/firestore"
import { SpotifyFullProfile, userConverter } from "../models/model.spotify"
import { SpotifyFullReturnAPI, SpotifyTrackAPI } from "../models/spotify.model"
import { TimeRange } from "../types"

export class SpotifyRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("auth")
            .withConverter(userConverter)
    }

    async saveTimeRangeTracksSpotify(topMusics: SpotifyFullReturnAPI, spotifyId: string, time_range: TimeRange) {
        const authSnapshot = await this.collection.where("spotifyId", "==", spotifyId).get();
        if (authSnapshot.empty) {
            return null;
        }
        const authDocId = authSnapshot.docs[0].id
        const collectionRef = this.collection.doc(authDocId);
        const timeRangeRef = collectionRef.collection(time_range)

        const snapshot = await timeRangeRef.get()
        const batch = getFirestore().batch()

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref)
        })

        if (!snapshot.empty) {
            await batch.commit()
        }

        return await timeRangeRef.add(topMusics)
    }

    async getTracksTimeRange(spotifyId: string, time_range: TimeRange): Promise<SpotifyTrackAPI[] | null> {
        const collectionSnapshot = await this.collection.where("spotifyId", "==", spotifyId).get()

        if (collectionSnapshot.empty) {
            return null
        }

        const collectionId = collectionSnapshot.docs[0].id
        const collectionRef = this.collection.doc(collectionId)
        const rangeRef = collectionRef.collection(time_range)

        const snapshot = await rangeRef.get()

        if (snapshot.empty) {
            console.log("Subcoleção vazia");
            return null;
        }

        const allTracks = snapshot.docs.flatMap(doc => {
            const data = doc.data().items as SpotifyTrackAPI[]
            return data ?? []
        })

        return allTracks

        // const tracks: TrackData[] = longTermSnapshot.docs.flatMap(doc => {
        //     const items = doc.data().items as SpotifyTrackAPI[]
        //     return items.map(track => ({
        //         name: track.name,
        //         id: track.id,
        //         type: track.type,
        //         album: {
        //             external_urls: track.album.external_urls,
        //             images: track.album.images,
        //             name: track.album.name,
        //             type: track.album.type
        //         },
        //         artists: track.artists.map((item) => ({
        //             external_urls: item.external_urls,
        //             name: item.name,
        //             type: item.type
        //         }))
        //     }))
        // })

        // //console.log(JSON.stringify(tracks, null, 2));
        // return tracks
    }


    //  async compareLongToShort(spotifyId: string) {
    //      const longRange = await this.getTracksTimeRange(spotifyId, TimeRange.long)
    //      const shortRange = await this.getTracksTimeRange(spotifyId, TimeRange.short)

    //     console.log("LONG RANGE: \n", longRange)
    //     console.log("SHORT RANGE\n\n", shortRange)

    //  }
}