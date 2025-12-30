import express from "express"
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { routes } from "./routes";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/internal-server-error";
import { celebrateError } from "./middlewares/celebrate-error.middleware";
import session from "express-session"
import cors from "cors";
import { notFound } from "./middlewares/page-not-found-error.middleware";

dotenv.config()
initializeAdminApp()

const app = express()
app.set("trust proxy", 1)

app.use(
  cors({
    origin: "https://uncriticisably-rushier-rashida.ngrok-free.dev", 
    credentials: true, // permite envio de cookies
  })
);


app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: "none" 
  }
}))

routes(app)

app.use(notFound)

app.use(celebrateError)
app.use(errorHandler)

app.listen(3000, () => {
  console.log("Server rodando em http://localhost:3000")
})