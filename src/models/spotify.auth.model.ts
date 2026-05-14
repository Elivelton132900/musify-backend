import { Joi } from "celebrate"
import dayjs, { Dayjs } from "dayjs"

export class SpotifyCredentials {
    access_token: string
    token_type: string
    expires_in: Date | number | Dayjs
    refresh_token: string
    scope: string

    constructor(data: Partial<SpotifyCredentials> = {}) {
        this.access_token = data.access_token || ""
        this.token_type = data.token_type || ""
        if (!(data.expires_in instanceof Date)) {
            if (data.expires_in instanceof String) {
                this.expires_in = dayjs(data.expires_in)
            } else if (data.expires_in instanceof Number) {
                this.expires_in = dayjs(data.expires_in)
            } else {
                this.expires_in = data.expires_in!
            }
        } else {
            this.expires_in = data.expires_in
        }
        this.refresh_token = data.refresh_token || ""
        this.scope = data.scope || ""
    }
}

export class SpotifyUserProfileInfo {
    country: string
    display_name: string
    email: string
    explicit_content: {
        filter_enabled: boolean
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
        this.country = data.country || ""
        this.display_name = data.display_name || ""
        this.email = data.email || ""
        this.explicit_content = {
            filter_enabled: data.explicit_content?.filter_enabled ?? false,
            filter_locked: data.explicit_content?.filter_locked ?? false,
        }
        this.external_urls = {
            spotify: data.external_urls?.spotify ?? "",
        }
        this.followers = {
            href: data.followers?.href ?? null,
            total: data.followers?.total ?? 0,
        }
        this.href = data.href ?? ""
        this.spotifyId = data.spotifyId ?? ""
        this.images = (data.images || []).map((img) => ({
            height: img.height || 0,
            url: img.url || "",
            width: img.width || 0,
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
    access_token: string
    token_type: string
    expires_in: Date | Number | Dayjs
    refresh_token: string
    scope!: string
    // Campos de SpotifyUserProfileInfo
    display_name: string
    email: string
    country: string
    explicit_content: { filter_enabled: boolean; filter_locked: boolean }
    external_urls: { spotify: string }
    followers: { href: null; total: number }
    href: string
    images: { height: number; url: string; width: number }[]
    product: string
    type: string
    uri: string
    spotifyId: string
    constructor(data: Partial<SpotifyCredentials & SpotifyUserProfileInfo> = {}) {
        this.access_token = data.access_token || ""
        this.token_type = data.token_type || ""
        //this.expires_in = data.expires_in instanceof Timestamp ? data.expires_in.toDate() : new Date(data.expires_in || Date.now());
        if (!(data.expires_in instanceof Date) || !(data.expires_in instanceof Dayjs)) {
            if (data.expires_in instanceof String) {
                this.expires_in = dayjs(data.expires_in)
            } else if (typeof data.expires_in === "number") {
                this.expires_in = new Date(
                    dayjs.unix(data.expires_in).format("YYYY-MM-DD HH:hh:ss"),
                )
            } else {
                this.expires_in = data.expires_in!
            }
        } else {
            this.expires_in = new Date(data.expires_in)
        }
        this.refresh_token = data.refresh_token || ""
        this.scope = data.scope || ""

        this.display_name = data.display_name || ""
        this.email = data.email || ""
        this.country = data.country || ""
        this.explicit_content = {
            filter_enabled: data.explicit_content?.filter_enabled ?? false,
            filter_locked: data.explicit_content?.filter_locked ?? false,
        }
        this.external_urls = { spotify: data.external_urls?.spotify || "" }
        this.followers = { href: data.followers?.href ?? null, total: data.followers?.total ?? 0 }
        this.href = data.href || ""
        this.spotifyId = data.spotifyId || ""
        this.images = (data.images || []).map((img) => ({
            height: img.height || 0,
            url: img.url || "",
            width: img.width || 0,
        }))
        this.product = data.product || ""
        this.type = data.type || ""
        this.uri = data.uri || ""
    }
}

export interface SpotifyJWTPayload {
    spotifyId: string
    userId: string
    email: string
    name: string
    display_name?: string
    access_token: string
    refresh_token: string
    expires_at: number
    iat?: number
    exp?: number
}

export interface SpotifyUserPayload {
    spotifyId: string,
    userId: string,
    email: string,
    display_name: string,
    access_token: string,
    refresh_token: string,
    expires_at: number,
};

export interface SpotifyCookies {
    spotify_token?: string
    csrf_token?: string
}

export const loginSchema = Joi.object().keys({
    code: Joi.string().trim().required(),
})
