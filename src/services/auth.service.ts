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
        if (!(await this.getUserBySpotifyId(profile.spotifyId))) {
            await this.authRepository.saveFullProfileInfo(profile)
        } else {
            throw new Error ("User already exists")
        }
        
    }
}