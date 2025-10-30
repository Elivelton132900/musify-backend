import { celebrate, Segments } from "celebrate"
import { Router } from "express"
import expressAsyncHandler from "express-async-handler"
import { limitToFetchSchema } from "../models/last-fm.model"
import { LastFmController } from "../controllers/last-fm.controller"
import { isAuthenticatedLastFm } from "../middlewares/is-authenticaded.last-fm.middleware"

export const lastFmRoutes = Router()

lastFmRoutes.get("/topTracksLastFm/:limit", isAuthenticatedLastFm, celebrate({ [ Segments.BODY ]: limitToFetchSchema }), expressAsyncHandler(LastFmController.getTopTracks))