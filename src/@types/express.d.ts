import "express-session";

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