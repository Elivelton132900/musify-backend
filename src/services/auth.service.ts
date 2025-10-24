
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { AuthRepository } from '../repositories/auth.repository';
import { SpotifyFullProfile } from './../models/auth.model';
import dotenv from "dotenv";

dotenv.config()

export class AuthService {

    private authRepository: AuthRepository;

    constructor() {
        this.authRepository = new AuthRepository()
    }


    async getUserBySpotifyId(spotifyId: string): Promise<SpotifyFullProfile | null> {
        return await this.authRepository.getUserBySpotifyId(spotifyId)
    }

    async saveFullProfileInfo(profile: SpotifyFullProfile) {
        const spotifyId = profile.spotifyId

        const userProfile = await this.getUserBySpotifyId(spotifyId)
        if (!userProfile) {

            await this.authRepository.saveFullProfileInfo(profile)

        } else if (userProfile && userProfile.expires_in) {
            dayjs.extend(utc)
            dayjs.extend(timezone)

            const expires_in = userProfile.expires_in
            const expires_in_dayjs = dayjs(expires_in)

            const now = dayjs().tz("America/Sao_Paulo")

            const timeHasPassed = now.isAfter(expires_in_dayjs);
        }
        else {
            throw new Error("User already exists")
        }
    }
}