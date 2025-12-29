import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { PercentageSchema, rediscoverLovedTracks, RediscoverSchema } from "../models/last-fm.model"
import { LastFmController } from "../controllers/last-fm.controller"
import { isAuthenticatedLastFm } from "../middlewares/is-authenticaded.last-fm.middleware"
import { resolveDateDefaults } from "../middlewares/resolve-date-defaults.middleware"


export const lastFmRoutes = Router()

lastFmRoutes.get("/topTracksByDate/:percentage", 
    isAuthenticatedLastFm, 
    celebrate( { [ Segments.PARAMS ]: PercentageSchema } ),
    expressAsyncHandler(LastFmController.getTopTracksByDate)
)

lastFmRoutes.get("/rediscover/:percentage/:limit",
    isAuthenticatedLastFm,
    celebrate( { [ Segments.PARAMS ]: RediscoverSchema }),
    expressAsyncHandler(LastFmController.rediscover)
)

lastFmRoutes.get(
    "/rediscoverLovedTracks/",
    isAuthenticatedLastFm,
    resolveDateDefaults,
    celebrate({
        [Segments.QUERY]: rediscoverLovedTracks
    }),
    expressAsyncHandler(LastFmController.rediscoverLovedTracks)
)