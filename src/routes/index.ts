import express from "express"
import { authRoutes } from "./auth.spotify.route"
import { spotifyRoutes } from "./spotify.route"
import { lastFmRoutes } from "./auth.last-fm.route"

export const routes = (app: express.Express) => {
    app.use(express.json({ limit: "5mb" }))
    app.use(authRoutes)
    app.use(spotifyRoutes)
    app.use(lastFmRoutes)
}