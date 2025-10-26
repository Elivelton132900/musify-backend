import express from "express"
import { authRoutes } from "./auth.route"
import { spotifyRoutes } from "./spotify.route"

export const routes = (app: express.Express) => {
    app.use(express.json({ limit: "5mb" }))
    app.use(authRoutes)
    app.use(spotifyRoutes)
}