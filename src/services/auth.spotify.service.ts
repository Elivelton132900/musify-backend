import { AuthSpotifyRepository } from '../repositories/auth.spotify.repository';
import { SaveProfileResult } from '../types';
import { hasTimePassed, refreshSpotifyToken } from '../utils/spotifyUtils';
import { SpotifyFullProfile } from "../models/spotify.auth.model.js"

export class AuthService {

    private authRepository: AuthSpotifyRepository;

    constructor() {
        this.authRepository = new AuthSpotifyRepository()
    }


    async getUserBySpotifyId(spotifyId: string): Promise<SpotifyFullProfile | null> {
        return await this.authRepository.getUserBySpotifyId(spotifyId)
    }

    private async refreshTokenIfExpired(userProfile: SpotifyFullProfile): Promise<SpotifyFullProfile | null> {
        if (hasTimePassed(userProfile.expires_in as Date)) {
            const refreshed = await refreshSpotifyToken(userProfile.refresh_token)
            await this.authRepository.saveNewToken(refreshed, userProfile.spotifyId)
            return refreshed
        }

        return null
    }

    private async createUser(profile: SpotifyFullProfile): Promise<SaveProfileResult> {
        await this.authRepository.saveFullProfileInfo(profile)
        return { status: "created", user: profile }
    }

    private async updateTokenIfExpired(userProfile: SpotifyFullProfile): Promise<SaveProfileResult> {
        const refreshed = await this.refreshTokenIfExpired(userProfile)

        return refreshed
            ? { status: "token_refreshed", user: refreshed }
            : { status: "already_exists", user: userProfile  }


    }

    async saveFullProfileInfo(profile: SpotifyFullProfile) {
        const existingUser = await this.getUserBySpotifyId(profile.spotifyId);

        if (!existingUser) {
            return await this.createUser(profile)
        }

        return await this.updateTokenIfExpired(existingUser);

    }
}
