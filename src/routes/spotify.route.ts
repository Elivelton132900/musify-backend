import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { SpotifyController } from "../controllers/spotify.controller"
import { isAuthenticatedSpotify } from "../middlewares/is-authenticated.spotify.middleware"

export const spotifyRoutes = Router()

spotifyRoutes.get("/compareLongToShort", isAuthenticatedSpotify, expressAsyncHandler(SpotifyController.syncAndCompareLongShort))
spotifyRoutes.get("/compareMediumToShort", isAuthenticatedSpotify, expressAsyncHandler(SpotifyController.syncAndCompareMediumShort))
spotifyRoutes.get("/compareLongToMedium", isAuthenticatedSpotify, expressAsyncHandler(SpotifyController.syncAndCompareLongMedium))