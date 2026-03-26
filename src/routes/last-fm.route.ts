import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import {  jobIdRediscoverLovedTracks, rediscoverLovedTracks } from "../models/last-fm.model"
import { LastFmController } from "../controllers/last-fm.controller"
import { resolveDateDefaults } from "../middlewares/resolve-date-defaults.middleware"
import { jobWithSameUrlExists } from "../middlewares/job-with-same-url-exists.middleware"


export const lastFmRoutes = Router()

lastFmRoutes.post(
    "/rediscoverLovedTracksQueue/",
    resolveDateDefaults,
    jobWithSameUrlExists,
    celebrate({
        [Segments.QUERY]: rediscoverLovedTracks
    }),
    expressAsyncHandler(LastFmController.rediscoverLovedTracks)
)

lastFmRoutes.post("/rediscoverLovedTracks/:jobId/cancel", celebrate({
    [Segments.PARAMS]: jobIdRediscoverLovedTracks
}),
expressAsyncHandler(LastFmController.cancelRediscover)
)

lastFmRoutes.get("/rediscoverLovedTracks/", celebrate({
    [Segments.QUERY]: jobIdRediscoverLovedTracks,
}),
    expressAsyncHandler(LastFmController.getRediscoverStatus)
)

lastFmRoutes.get("/rediscoverLovedTracks/countJobs", expressAsyncHandler(
    LastFmController.countJobs
))

lastFmRoutes.delete("/rediscoverLovedTracks/:jobId/delete", celebrate({
    [Segments.PARAMS]: jobIdRediscoverLovedTracks
}),
    expressAsyncHandler(LastFmController.deleteRediscover)
)