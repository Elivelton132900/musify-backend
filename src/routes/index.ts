import express from "express"
import { authRoutes } from "./auth.route"

export const routes = (app: express.Express) => {
    app.use(express.json({ limit: "5mb" }))
    app.use(authRoutes)
}