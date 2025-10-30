import { CollectionReference, getFirestore } from "firebase-admin/firestore"
import { SpotifyFullProfile, userSpotifyConverter } from "../models/spotify.auth.model.js"
import { SpotifyFullReturnAPI, SpotifyTrackAPI } from "../models/spotify.model"
import { TimeRange } from "../types"

export class SpotifyRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("authSpotify")
            .withConverter(userSpotifyConverter)
    }

    async saveTimeRangeTracksSpotify(topMusics: SpotifyFullReturnAPI, spotifyId: string, time_range: TimeRange) {
        const authSnapshot = await this.collection.where("spotifyId", "==", spotifyId).get();
        if (authSnapshot.empty) {
            return null
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

    }
}