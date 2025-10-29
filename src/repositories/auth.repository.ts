import { SpotifyCredentials, userConverter } from '../models/model.spotify';
import { CollectionReference, getFirestore } from "firebase-admin/firestore";
import { SpotifyFullProfile } from "../models/model.spotify";
import { returnDateExpiresin } from '../utils/spotifyUtils';

export class AuthRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("auth")
            .withConverter(userConverter)
    }

    async getUserBySpotifyId(spotifyId: string): Promise<SpotifyFullProfile | null> {
        const existingUser = await this.collection.where("spotifyId", "==", spotifyId).get()

        if (existingUser.empty) {
            return null
        }
        return existingUser.docs[0].data()
    }

    async saveNewToken(spotifyCredentials: SpotifyCredentials, spotifyId: string) {
        const snapshot = await this.collection.where("spotifyId", "==", spotifyId).get();

        if (snapshot.empty) {
            throw new Error("Usuário não encontrado para atualizar token");
        }

        const userDoc = snapshot.docs[0].ref;
        await userDoc
            .withConverter(null)
            .set({
                ...spotifyCredentials,
                expires_in: returnDateExpiresin(Number(spotifyCredentials.expires_in))
            }, 
            {merge: true}
        )
    }
    

    async saveFullProfileInfo(fullProfileInfo: SpotifyFullProfile) {
        await this.collection.add(fullProfileInfo)
    }

}