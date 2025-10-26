import { CollectionReference, getFirestore } from "firebase-admin/firestore"
import { SpotifyFullProfile, userConverter } from "../models/auth.model"
import { SpotifyFullReturnAPI } from "../models/spotify.model"
import { TimeRange } from "../types"

export class SpotifyRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("auth")
            .withConverter(userConverter)
    }

    async saveTimeRangeTracksSpotify(returnLongTerm: SpotifyFullReturnAPI, spotifyId: string, time_range: TimeRange) {
        const authSnapshot = await this.collection.where("spotifyId", "==", spotifyId).get();
        if (authSnapshot.empty) {
            return null;
        }
        const authDocId = authSnapshot.docs[0].id
        const collectionRef = this.collection.doc(authDocId);
        const timeRangeRef =  collectionRef.collection(time_range)

        const snapshot = await timeRangeRef.get()
        const batch = getFirestore().batch()
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref)
        })

        if (!snapshot.empty) {
            await batch.commit()
        }

        return await timeRangeRef.add(returnLongTerm)
    }
}