import express from "express"
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { routes } from "./routes";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/internal-server-error";
import { celebrateError } from "./middlewares/celebrate-error.middleware";

dotenv.config()
initializeAdminApp()

const app = express()
routes(app)

app.use(celebrateError)
app.use(errorHandler)

app.listen(3000, () => {
  console.log("Server rodando em http://localhost:3000");
});