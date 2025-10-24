import { CollectionReference, getFirestore } from "firebase-admin/firestore";
import { authConverter, SpotifyFullProfile } from "../models/auth.model";

export class AuthRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("auth")
            .withConverter(authConverter)
    }

    async getUserBySpotifyId(spotifyId: string): Promise<SpotifyFullProfile | null> {
        const existingUser = await this.collection.where("spotifyId", "==", spotifyId).get()
        
        if (existingUser.empty) {
            return null
        }
        console.log(existingUser.docs[0].data())
        return existingUser.docs[0].data()
    }

    async saveFullProfileInfo(fullProfileInfo: SpotifyFullProfile) {
        await this.collection.add(fullProfileInfo)
    }

}