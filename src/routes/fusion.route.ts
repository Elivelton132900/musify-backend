import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { jobIdRediscoverLovedTracks } from "../models/last-fm.model"
import { FusionController } from "../controllers/fusion.controller"
import { jobWithSameUrlExists } from "../middlewares/job-with-same-url-exists-fusion.middleware"
import { fusionBodySchema, CancelOrDeleteSchemaFusion } from "../models/fusion.model"
import { isAuthenticatedSpotify } from "../middlewares/is-authenticated.spotify.middleware"
import { restrictSameUser } from "../middlewares/only-delete-cancel-same-user.middleware"
import { csrfProtection } from "../middlewares/csrf-protection.middleware"

export const fusionRoutes = Router()

fusionRoutes.get(
    "/fusion/loved-tracks/jobs/:jobId",
    celebrate({
        [Segments.PARAMS]: jobIdRediscoverLovedTracks,
    }),
    expressAsyncHandler(FusionController.getJob),
)


fusionRoutes.post(
    "/fusion/loved-tracks/jobs/:jobId/cancel",
    csrfProtection,
        celebrate({
        [Segments.PARAMS]: jobIdRediscoverLovedTracks,
    }),
    expressAsyncHandler(FusionController.cancelRediscover)
)


fusionRoutes.post(
    "/fusion/loved-tracks/jobs",
    csrfProtection,
    isAuthenticatedSpotify,
    jobWithSameUrlExists,
    celebrate({
        [Segments.BODY]: fusionBodySchema
    }),
    expressAsyncHandler(FusionController.rediscoverFusion),
)

fusionRoutes.get(
    "/fusion/loved-tracks/jobs",
    expressAsyncHandler(FusionController.getJobs)
)

fusionRoutes.delete(
    "/fusion/loved-tracks/jobs/:jobId/:lastFmUser/:spotifyId",
    csrfProtection,
    restrictSameUser,
    expressAsyncHandler(FusionController.deleteRediscover)
)

fusionRoutes.post(
    "/fusion/loved-tracks/jobs/:jobId/:lastFmUser/:spotifyId/cancel",
    restrictSameUser,
    celebrate({
        [Segments.PARAMS]: CancelOrDeleteSchemaFusion,
    }),
    expressAsyncHandler(FusionController.cancelRediscover),
)