import { jobIdRediscoverLovedTracks } from './../models/last-fm.model';
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { SpotifyController } from "../controllers/spotify.controller"
import { isAuthenticatedSpotify } from "../middlewares/is-authenticated.spotify.middleware"
import { jobWithSameUrlExists } from "../middlewares/job-with-same-url-exists-spotify.middleware"
import { celebrate, Segments } from "celebrate"
import { comparationRange } from "../models/spotify.model"

export const spotifyRoutes = Router()

// mesmo em requisicoes get  middleware novo?
// filtro por popularidade e menos popularidade? 
spotifyRoutes.post(
    "/spotify/loved-tracks/comparison-jobs",
    isAuthenticatedSpotify,
    jobWithSameUrlExists,
    celebrate({
        [Segments.BODY]: comparationRange
    }),
    expressAsyncHandler(SpotifyController.syncAndCompareTimeRange)
)

spotifyRoutes.post(
    "/spotify/loved-tracks/jobs/:jobId/cancel",
    jobWithSameUrlExists,
    celebrate({
        [Segments.PARAMS]: jobIdRediscoverLovedTracks
    }),
    expressAsyncHandler(SpotifyController.cancelRediscover)
)

spotifyRoutes.get("/spotify/loved-tracks/jobs/:jobId", celebrate({
    [Segments.PARAMS]: jobIdRediscoverLovedTracks,
}),
    expressAsyncHandler(SpotifyController.getJob)
)

spotifyRoutes.get("/spotify/loved-tracks/jobs", expressAsyncHandler(
    SpotifyController.getJobs
))

spotifyRoutes.delete("/spotify/loved-tracks/jobs/:jobId", celebrate({
    [Segments.PARAMS]: jobIdRediscoverLovedTracks
}),
    expressAsyncHandler(SpotifyController.deleteRediscover)
)