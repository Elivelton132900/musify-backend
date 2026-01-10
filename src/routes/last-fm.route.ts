import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import {  rediscoverLovedTracks } from "../models/last-fm.model"
import { LastFmController } from "../controllers/last-fm.controller"
import { isAuthenticatedLastFm } from "../middlewares/is-authenticaded.last-fm.middleware"
import { resolveDateDefaults } from "../middlewares/resolve-date-defaults.middleware"


export const lastFmRoutes = Router()

lastFmRoutes.get(
    "/rediscoverLovedTracks/",
    isAuthenticatedLastFm,
    resolveDateDefaults,
    celebrate({
        [Segments.QUERY]: rediscoverLovedTracks
    }),
    expressAsyncHandler(LastFmController.rediscoverLovedTracks)
)