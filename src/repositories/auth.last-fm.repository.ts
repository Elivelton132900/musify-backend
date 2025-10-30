import { CollectionReference, getFirestore } from "firebase-admin/firestore";
import { LastFmFullProfile, userLastFmConverter } from "../models/last-fm.auth.model";

export class AuthLastFmRepository {

    private collection: CollectionReference<LastFmFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("authLastFm")
            .withConverter(userLastFmConverter)
    }

    async saveFullProfileInfo(fullProfileInfo: LastFmFullProfile) {
        await this.collection.add(fullProfileInfo)
    }

}