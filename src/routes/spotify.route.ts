import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { SpotifyController } from "../controllers/spotify.controller"
import { isAuthenticated } from "../middlewares/is-authenticated.middleware"

export const spotifyRoutes = Router()

spotifyRoutes.get("/compareLongToShort", isAuthenticated, expressAsyncHandler(SpotifyController.syncAndCompareLongShort))
spotifyRoutes.get("/compareMediumToShort", isAuthenticated, expressAsyncHandler(SpotifyController.syncAndCompareMediumShort))
spotifyRoutes.get("/compareLongToMedium", isAuthenticated, expressAsyncHandler(SpotifyController.syncAndCompareLongMedium))