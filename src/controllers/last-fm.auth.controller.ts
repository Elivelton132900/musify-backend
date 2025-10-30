import { Request, Response } from "express"
import {  getLoginUrl } from "../utils/lastFmUtils"
import { AuthLastFmService } from "../services/last-fm.auth.service"
import { LastFmFullProfile, LastFmSession, User } from "../models/last-fm.auth.model"

export class AuthLastFmController {

    static async auth(req: Request, res: Response) {

        const API_KEY = process.env.LAST_FM_API_KEY!
        const authURL = getLoginUrl(API_KEY)
        res.redirect(authURL)

    }

    static async callback(req: Request, res: Response) {



        const lastFmService = new AuthLastFmService()

        const token = req.query.token as string

        if (!token) {
            res.status(400).json({ error: "Code not provided" })
            return
        }

        const API_KEY = process.env.LAST_FM_API_KEY!

        const session = await lastFmService.getSession(token, API_KEY)
        const sessionDestructured = new LastFmSession(session)

        req.session.lastFmSession = {
            token: req.query.token as string,
            user: sessionDestructured.name
        }
        
        const userInfo = await lastFmService.getUserInfo(API_KEY, sessionDestructured.name)
        const userInfoDestructured = new User(userInfo)

        const fullProfile: LastFmFullProfile = {...sessionDestructured, ...userInfoDestructured}
        const savedProfile = await lastFmService.saveFullProfileInfo(fullProfile)

        res.json({
            message: "Login Successful",
            user: savedProfile,
            session: req.session.lastFmSession
        })

    }

}