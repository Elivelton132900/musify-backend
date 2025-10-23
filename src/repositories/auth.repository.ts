import { CollectionReference, getFirestore } from "firebase-admin/firestore";
import { authConverter, SpotifyFullProfile } from "../models/auth.model";

export class AuthRepository {

    private collection: CollectionReference<SpotifyFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("auth")
            .withConverter(authConverter)
    }

    async saveFullProfileInfo(fullProfileInfo: SpotifyFullProfile) {
        await this.collection.add(fullProfileInfo)
    }

}