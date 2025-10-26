import { CollectionReference, getFirestore } from "firebase-admin/firestore"
import { SpotifyFullProfile, userConverter } from "../models/auth.model"

export class SpotifyRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor () {
        this.collection = getFirestore()
                            .collection("auth")
                            .withConverter(userConverter)
    }

    async getAccessTokenById(spotifyId: string): Promise<string | null> {
        const user = await this.collection.where("spotifyId", "==", spotifyId).get()

        if (user.empty) {
            return null
        }
        return user.docs[0].data().access_token
    }

}