import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { LimitRediscoverLovedTracks, PercentageSchema, RediscoverSchema } from "../models/last-fm.model"
import { LastFmController } from "../controllers/last-fm.controller"
import { isAuthenticatedLastFm } from "../middlewares/is-authenticaded.last-fm.middleware"

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

lastFmRoutes.get("/rediscoverLovedTracks/:percentage/:limit", 
    isAuthenticatedLastFm, 
    celebrate({ [ Segments.PARAMS ]: LimitRediscoverLovedTracks }),
    expressAsyncHandler(LastFmController.rediscoverLovedTracks))