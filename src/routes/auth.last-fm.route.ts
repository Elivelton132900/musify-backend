import { Router } from "express";

import expressAsyncHandler from "express-async-handler";
import { AuthLastFmController } from "../controllers/last-fm.auth.controller";
import { celebrate, errors, Segments } from "celebrate";
import { loginSchema } from "../models/last-fm.auth.model";

export const authLastFmRoutes = Router()

authLastFmRoutes.get("/loginlastfm", expressAsyncHandler(AuthLastFmController.auth))
authLastFmRoutes.get("/callbacklastfm", celebrate({ [ Segments.QUERY ]: loginSchema }), expressAsyncHandler(AuthLastFmController.callback))

authLastFmRoutes.use(errors())