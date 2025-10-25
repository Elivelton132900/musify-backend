import { Joi } from "celebrate";
import { FirestoreDataConverter, DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase-admin/firestore"

export type SaveProfileResult =
    | { status: "created"; user: SpotifyFullProfile }
    | { status: "token_refreshed"; user: SpotifyFullProfile }
    | { status: "already_exists"; user: SpotifyFullProfile };

export class SpotifyCredentials {
    access_token: string
    token_type: string
    expires_in: Date | number
    refresh_token: string
    scope: string

    constructor(data: Partial<SpotifyCredentials> = {}) {
        this.access_token = data.access_token || ''
        this.token_type = data.token_type || ''
        if (data.expires_in instanceof Timestamp) {
            this.expires_in = data.expires_in.toDate()
        } else {
            this.expires_in = data.expires_in!
        }
        // COMO INICIALIZAR?

        this.refresh_token = data.refresh_token || ''
        this.scope = data.scope || ''
    }
}

export class SpotifyUserProfileInfo {
    country: string
    display_name: string
    email: string
    explicit_content: {
        filter_enabled: boolean,
        filter_locked: boolean
    }
    external_urls: {
        spotify: string
    }
    followers: {
        href: null
        total: number
    }
    href: string
    images: {

        height: number
        url: string
        width: number
    }[]
    product: string
    type: string
    uri: string
    spotifyId: string


    constructor(data: Partial<SpotifyUserProfileInfo> = {}) {
        this.country = data.country || ''
        this.display_name = data.display_name || ''
        this.email = data.email || ''
        this.explicit_content = {
            filter_enabled: data.explicit_content?.filter_enabled ?? false,
            filter_locked: data.explicit_content?.filter_locked ?? false
        }
        this.external_urls = {
            spotify: data.external_urls?.spotify ?? ""
        }
        this.followers = {
            href: data.followers?.href ?? null,
            total: data.followers?.total ?? 0
        }
        this.href = data.href ?? ""
        this.spotifyId = data.spotifyId ?? ""
        this.images = (data.images || []).map(img => ({
            height: img.height || 0,
            url: img.url || "",
            width: img.width || 0
        }))
        this.product = data.product || ""
        this.type = data.type || ""
        this.uri = data.uri || ""
    }
}

export interface RefreshToken {
    [key: string]: string
    grant_type: string
    refresh_token: string
    client_id: string
    client_secret: string
}

export class SpotifyFullProfile {
    // Campos de SpotifyCredentials
    access_token!: string;
    token_type!: string;
    expires_in!: Date | number;
    refresh_token!: string;
    scope!: string;
    // Campos de SpotifyUserProfileInfo
    display_name!: string;
    email!: string;
    country!: string;
    explicit_content!: { filter_enabled: boolean; filter_locked: boolean };
    external_urls!: { spotify: string };
    followers!: { href: null; total: number };
    href!: string;
    images!: { height: number; url: string; width: number }[];
    product!: string;
    type!: string;
    uri!: string;
    spotifyId!: string
    constructor(data: Partial<SpotifyCredentials & SpotifyUserProfileInfo> = {}) {
        this.access_token = data.access_token || '';
        this.token_type = data.token_type || '';
        this.expires_in = data.expires_in instanceof Timestamp ? data.expires_in.toDate() : new Date(data.expires_in || Date.now());
        this.refresh_token = data.refresh_token || '';
        this.scope = data.scope || '';

        this.display_name = data.display_name || '';
        this.email = data.email || '';
        this.country = data.country || '';
        this.explicit_content = {
            filter_enabled: data.explicit_content?.filter_enabled ?? false,
            filter_locked: data.explicit_content?.filter_locked ?? false,
        };
        this.external_urls = { spotify: data.external_urls?.spotify || '' };
        this.followers = { href: data.followers?.href ?? null, total: data.followers?.total ?? 0 };
        this.href = data.href || '';
        this.spotifyId = data.spotifyId || '';
        this.images = (data.images || []).map(img => ({
            height: img.height || 0,
            url: img.url || '',
            width: img.width || 0,
        }));
        this.product = data.product || '';
        this.type = data.type || '';
        this.uri = data.uri || '';
    }
}

export const loginSchema = Joi.object().keys({
    code: Joi.string().trim().required()
})


export const authConverter: FirestoreDataConverter<SpotifyFullProfile> = {

    toFirestore: (auth: SpotifyFullProfile): DocumentData => {
        return ({
            access_token: auth.access_token,
            token_type: auth.token_type,
            expires_in: auth.expires_in instanceof Date ? auth.expires_in : new Date(auth.expires_in),
            refresh_token: auth.refresh_token,
            scope: auth.scope,
            display_name: auth.display_name,
            email: auth.email,
            country: auth.country,
            explicit_content: {
                filter_enabled: auth.explicit_content?.filter_enabled ?? false,
                filter_locked: auth.explicit_content?.filter_locked ?? false,
            },
            external_urls: { spotify: auth.external_urls?.spotify ?? "" },
            followers: { href: auth.followers?.href ?? null, total: auth.followers?.total ?? 0 },
            href: auth.href,
            spotifyId: auth.spotifyId,
            images: (auth.images || []).map(img => ({
                height: img.height || 0,
                url: img.url || "",
                width: img.width || 0,
            })),
            product: auth.product,
            type: auth.type,
            uri: auth.uri,
        })
    },

    fromFirestore: (snapshot: QueryDocumentSnapshot): SpotifyFullProfile => {
        const data = snapshot.data()
        return new SpotifyFullProfile({
            spotifyId: data.spotifyId,
            ...data as Partial<SpotifyFullProfile>,

        })
    }
}