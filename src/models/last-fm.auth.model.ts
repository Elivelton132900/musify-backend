import { Joi } from "celebrate";
import { DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from "firebase-admin/firestore";

export interface ParamsHash {
    api_key: string | ""
    method: "auth.getSession",
    token: string | "",
}

interface lastFmImage {
    size: string,
    "#text": string
}

interface LastFmRegistered {
    unixtime: string,
    "#text": string
}

export interface lastFmSession {
    token: string
}

export class LastFmSession {
    nameSession: string
    key: string
    subscriberSession: number

    constructor(data: LastFmSession) {
        this.nameSession = data.nameSession
        this.key = data.key
        this.subscriberSession = data.subscriberSession
    }
}

class User {
    nameUser: string
    age: string
    subscriberUser: string
    realname: string
    bootstrap: string
    playcount: string
    artist_count: string
    playlists: string
    track_count: string
    album_count: string
    image: lastFmImage[]
    registered: LastFmRegistered
    country: string
    gender: string
    url: string
    type: string

    constructor(data: User) {
        this.nameUser = data.nameUser
        this.age = data.age
        this.subscriberUser = data.subscriberUser
        this.realname = data.realname
        this.bootstrap = data.bootstrap
        this.playcount = data.playcount
        this.artist_count = data.artist_count
        this.playlists = data.playlists
        this.track_count = data.track_count
        this.album_count = data.album_count
        this.image = (data.image || []).map(img => ({
            size: img.size,
            "#text": img["#text"]
        }))
        this.registered = data.registered
        this.country = data.country
        this.gender = data.gender
        this.url = data.url
        this.type = data.type
    }
}

export class LastFmFullProfile {

    // session

    nameSession: string
    key: string
    subscriberSession: number

    // user
    nameUser: string
    age: string
    subscriberUser: string
    realname: string
    bootstrap: string
    playcount: string
    artist_count: string
    playlists: string
    track_count: string
    album_count: string
    image: lastFmImage[]
    registered: LastFmRegistered
    country: string
    gender: string
    url: string
    type: string
    constructor(data: Partial<User & LastFmSession> = {}) {
        this.nameSession = data.nameSession || ""
        this.key = data.key || ""
        this.subscriberSession = data.subscriberSession || 0
        this.nameUser = data.nameUser || ""
        this.age = data.age || ""
        this.subscriberUser = data.subscriberUser || ""
        this.realname = data.realname || ""
        this.bootstrap = data.bootstrap || ""
        this.playcount = data.playcount || ""
        this.artist_count = data.artist_count || ""
        this.playlists = data.playlists || ""
        this.track_count = data.track_count || ""
        this.album_count = data.album_count || ""
        this.image = (data.image || []).map((image) => ({
            size: image.size,
            "#text": image["#text"]
        }))
        this.registered = data.registered || {
            unixtime: "",
            "#text": ""
        }
        this.country = data.country || ""
        this.gender = data.gender || ""
        this.url = data.url || ""
        this.type = data.type || ""

    }
}

export const userLastFmConverter: FirestoreDataConverter<LastFmFullProfile> = {
    toFirestore: (lastFmProfile: LastFmFullProfile): DocumentData => {
        return ({
            nameSession: lastFmProfile.nameSession,
            key: lastFmProfile.key,
            subscriberSession: lastFmProfile.subscriberSession,
            nameUser: lastFmProfile.nameUser,
            age: lastFmProfile.age,
            subscriberUser: lastFmProfile.subscriberUser,
            realname: lastFmProfile.realname,
            bootstrap: lastFmProfile.bootstrap,
            playcount: lastFmProfile.playcount,
            artists_count: lastFmProfile.artist_count,
            playlists: lastFmProfile.playlists,
            track_count: lastFmProfile.track_count,
            album_count: lastFmProfile.album_count,
            image: lastFmProfile.image,
            registered: lastFmProfile.registered,
            country: lastFmProfile.country,
            gender: lastFmProfile.gender,
            url: lastFmProfile.url,
            type: lastFmProfile.type
        })
    },
    fromFirestore: (snapshot: QueryDocumentSnapshot): LastFmFullProfile => {
        const data = snapshot.data()
        return new LastFmFullProfile({
            key: data.key,
            ...data as Partial<LastFmFullProfile>,

    })}
}

export const loginSchema = Joi.object().keys({
    token: Joi.string().trim().required()
})

