import { Request, Response } from "express"
import { AuthService } from "../services/auth.service";

export class AuthController {
    
    static async getAccessToken(req: Request, res: Response) {
        const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
        res.send(await new AuthService().auth(auth))
    }
}