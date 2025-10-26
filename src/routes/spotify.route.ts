import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { SpotifyController } from "../controllers/spotify.controller"
import { isAuthenticated } from "../middlewares/is-authenticated.middleware"

export const spotifyRoutes = Router()

spotifyRoutes.get("/top", isAuthenticated, expressAsyncHandler(SpotifyController.getTopMusics))
spotifyRoutes.get("/compareLongToShort", isAuthenticated, expressAsyncHandler(SpotifyController.compareLongToShort))