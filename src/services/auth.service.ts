import { SpotifyFullProfile } from './../models/auth.model';
import dotenv from "dotenv";
import { AuthRepository } from '../repositories/auth.repository';

dotenv.config()

export class AuthService {

    private authRepository: AuthRepository;

    constructor() {
        this.authRepository = new AuthRepository()
    }

    async saveFullProfileDB(profile: SpotifyFullProfile) {
        await this.authRepository.saveFullProfileInfo(profile)
    }
}