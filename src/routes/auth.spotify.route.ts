import { Router } from "express";
import expressAsyncHandler from "express-async-handler";
import { AuthSpotifyController } from "../controllers/spotify.auth.controller";
import { celebrate, Segments, errors } from "celebrate";
import { loginSchema } from "../models/spotify.auth.model.js"

export const authSpotifyRoutes = Router()

authSpotifyRoutes.get("/loginspotify", expressAsyncHandler(AuthSpotifyController.login))
authSpotifyRoutes.get("/callbackspotify", celebrate({ [ Segments.QUERY ]: loginSchema }), expressAsyncHandler(AuthSpotifyController.callback))

authSpotifyRoutes.use(errors())