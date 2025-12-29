import "express-serve-static-core";
import { Session, SessionData } from "express-session";

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

    session: Session & Partial<SessionData>;
  }
}