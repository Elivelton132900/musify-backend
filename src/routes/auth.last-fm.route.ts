import { Router } from "express";

import expressAsyncHandler from "express-async-handler";
import { LastFmController } from "../controllers/last-fm.auth.controller";
import { celebrate, errors, Segments } from "celebrate";
import { loginSchema } from "../models/last-fm.auth.model";

export const lastFmRoutes = Router()

lastFmRoutes.get("/loginlastfm", expressAsyncHandler(LastFmController.auth))
lastFmRoutes.get("/callbacklastfm", celebrate({ [ Segments.QUERY ]: loginSchema }), expressAsyncHandler(LastFmController.callback))

lastFmRoutes.use(errors())