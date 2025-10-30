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
    name: string
    key: string
    subscriber: number

    constructor(data: { session: { name: string; key: string; subscriber: number } }) {
        this.name = data.session.name
        this.key = data.session.key
        this.subscriber = data.session.subscriber
    }
}

export class User {
    age: string
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

    constructor(data: {
        user: {
            age: string
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
        }
    }) {
        this.age = data.user.age
        this.realname = data.user.realname
        this.bootstrap = data.user.bootstrap
        this.playcount = data.user.playcount
        this.artist_count = data.user.artist_count
        this.playlists = data.user.playlists
        this.track_count = data.user.track_count
        this.album_count = data.user.album_count
        this.image = (data.user.image || []).map(img => ({
            size: img.size,
            "#text": img["#text"]
        }))
        this.registered = data.user.registered
        this.country = data.user.country
        this.gender = data.user.gender
        this.url = data.user.url
        this.type = data.user.type
    }
}

export class LastFmFullProfile {

    // session

    name: string
    key: string
    subscriber: number

    // user
    age: string
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
        this.name = data.name || ""
        this.key = data.key || ""
        this.subscriber = data.subscriber || 0
        this.age = data.age || ""
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
            name: lastFmProfile.name,
            key: lastFmProfile.key,
            subscriberSession: lastFmProfile.subscriber,
            age: lastFmProfile.age,
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

        })
    }
}

export const loginSchema = Joi.object().keys({
    token: Joi.string().trim().required()
})

