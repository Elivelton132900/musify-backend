import { Router } from "express";
import expressAsyncHandler from "express-async-handler";
import { AuthController } from "../controllers/spotify.auth.controller";
import { celebrate, Segments, errors } from "celebrate";
import { loginSchema } from "../models/spotify.auth.model.js"

export const authRoutes = Router()

authRoutes.get("/loginspotify", expressAsyncHandler(AuthController.login))
authRoutes.get("/callbackspotify", celebrate({ [ Segments.QUERY ]: loginSchema }), expressAsyncHandler(AuthController.callback))

authRoutes.use(errors())