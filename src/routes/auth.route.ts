import { Router } from "express";
import expressAsyncHandler from "express-async-handler";
import { AuthController } from "../controllers/auth.controller";

export const authRoutes = Router()

authRoutes.get("/login", expressAsyncHandler(AuthController.login))
authRoutes.get("/callback", expressAsyncHandler(AuthController.callback))
// authRoutes.get("/refresh", expressAsyncHandler(AuthController.refreshSpotifyToken))