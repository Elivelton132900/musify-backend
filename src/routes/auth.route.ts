import { Router } from "express";
import expressAsyncHandler from "express-async-handler";
import { AuthController } from "../controllers/auth.controller";

export const authRoutes = Router()

authRoutes.get("/spotify-token", expressAsyncHandler(AuthController.getAccessToken))