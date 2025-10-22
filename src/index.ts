import express from "express"
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { routes } from "./routes";
// import { initializeApp as initializeFirebaseApp } from "firebase/app";


initializeAdminApp()

const app = express()
routes(app)

app.listen(3000, "0.0.0.0", () => {
    console.log("Musify backend ativo!")
})

