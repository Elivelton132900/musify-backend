import admin from "firebase-admin"
import musifyAdmin from "../../musifyAdmin.json"
console.log("🔥 Inicializando Firebase...");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(musifyAdmin as admin.ServiceAccount)
    })
}

export { admin }