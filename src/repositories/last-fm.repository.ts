import { CollectionReference, getFirestore } from "firebase-admin/firestore"
import { LastFmFullProfile, userLastFmConverter } from "../models/last-fm.auth.model"

export class LastFmRepository {

    private collection: CollectionReference<LastFmFullProfile>

    constructor() {
        this.collection = getFirestore()
            .collection("authLastFm")
            .withConverter(userLastFmConverter)
    }

    async getUserByName(username: string) {

        const snapshot = await this.collection.where("name", "==", username).get()

        if (snapshot.empty) {
            return Error("User Not Found")
        }

        return snapshot.docs[0].data() as LastFmFullProfile

    }

    async getTotalScrobbles(username: string) {
        const user = await this.getUserByName(username)

        if (user instanceof Error) {
            throw new Error("User not found")
        }
        return Number(user.playcount)

    }

    async getCreationUnixtime(username: string) {
        const user = await this.getUserByName(username)

        if (user instanceof Error) {
            throw new Error()
        }
        return user.registered.unixtime
    }

}