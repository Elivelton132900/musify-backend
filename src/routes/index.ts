import express from "express"
import { authSpotifyRoutes } from "./auth.spotify.route"
import { spotifyRoutes } from "./spotify.route"
import { authLastFmRoutes } from "./auth.last-fm.route"
import { lastFmRoutes } from "./last-fm.route"

export const routes = (app: express.Express) => {
    app.use(express.json({ limit: "5mb" }))
    app.use(authSpotifyRoutes)
    app.use(spotifyRoutes)
    app.use(authLastFmRoutes)
    app.use(lastFmRoutes)
}