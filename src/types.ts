
import { SpotifyFullProfile } from "./models/spotify.auth.model";


export type SaveProfileResult =
    | { status: "created"; user: SpotifyFullProfile }
    | { status: "token_refreshed"; user: SpotifyFullProfile }
    | { status: "already_exists"; user: SpotifyFullProfile };

export enum TimeRange {
    short = "short_term",
    medium = "medium_term",
    long = "long_term"
}

declare module "express-serve-static-core" {
    interface Request {
        user?: {
            spotifyId: string;
            access_token: string;
            refresh_token: string;

        };
    }
}

import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      spotifyId: string;
      access_token: string;
      refresh_token: string;
    };
  }
}


declare module "express-serve-static-core" {
    interface Request {
        lastFmSession?: {
          token: string
          user: string
        };
    }
}


declare module "express-session" {
  interface SessionData {
    lastFmSession?: {
      token: string
      user: string
    };
  }
}
