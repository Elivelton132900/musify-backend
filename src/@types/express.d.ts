import "express-session";

//  não sendo recomendado para produção sem configurar um banco externo
declare module "express-session" {
  interface SessionData {
    user?: {
      spotifyId: string
      access_token: string
      refresh_token: string
    }

    lastFmSession?: {
      token: string
      user: string
    }
  }
}

//?
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      spotifyId: string
      access_token: string
      refresh_token: string
    }

    lastFmSession?: {
      token: string
      user: string
    }
  }
}