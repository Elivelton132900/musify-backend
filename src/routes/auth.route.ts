import { Router } from "express";
import expressAsyncHandler from "express-async-handler";
import { AuthController } from "../controllers/auth.controller";
import { celebrate, Segments, errors } from "celebrate";
import { loginSchema } from "../models/auth.model";

export const authRoutes = Router()

authRoutes.get("/login", expressAsyncHandler(AuthController.login))
authRoutes.get("/callbackspotify", celebrate({ [ Segments.QUERY ]: loginSchema }), expressAsyncHandler(AuthController.callback))

authRoutes.use(errors())