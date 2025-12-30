import { Joi } from "celebrate";
import { LastFmFullProfile } from "./last-fm.auth.model";
import dayjs from "dayjs";

export enum SearchFor {
  early_days = 'early_days',
  old_times = 'old_times',
  mid_years = 'mid_years',
}

export const SearchForValues: Record<SearchFor, number> = {
  [SearchFor.early_days]: 5,
  [SearchFor.old_times]: 15,
  [SearchFor.mid_years]: 50
}

export const RecentYears = 90;

interface LastFmImage {
  size: string;
  "#text": string;
}

interface LastFmStreamable {
  fulltrack: string;
  "#text": string;
}

interface LastFmArtist {
  name: string;
  url: string;
  mbid: string;
}

interface LastFmTrackAttr {
  rank: string;
}

export class LastFmTrack {
  name: string;
  mbid: string;
  playcount: string;
  duration: string;
  url: string;
  streamable: LastFmStreamable;
  image: LastFmImage[];
  artist: LastFmArtist;
  attr: LastFmTrackAttr;

  constructor(data: any = {}) {
    this.name = data.name || "";
    this.mbid = data.mbid || "";
    this.playcount = data.playcount || "0";
    this.duration = data.duration || "0";
    this.url = data.url || "";
    this.streamable = data.streamable || { fulltrack: "0", "#text": "0" };
    this.image = (data.image || []).map((img: any) => ({
      size: img.size,
      "#text": img["#text"]
    }));
    this.artist = data.artist || { name: "", url: "", mbid: "" };
    this.attr = data["@attr"] || { rank: "" };
  }
}

/**
 * Representa os metadados do top tracks (ex: página, total, usuário)
 */
export interface LastFmTopTracksAttr {
  user: string;
  totalPages: string;
  page: string;
  perPage: string;
  total: string;
}

/**
 * Representa o bloco completo de toptracks retornado pela API
 */
export class LastFmTopTracks {
  tracks: LastFmTrack[];
  attr: LastFmTopTracksAttr;

  constructor(data: {
    toptracks: {
      track: LastFmTrack[],
      "@attr": LastFmTopTracksAttr
    }
  }) {
    // A resposta da API vem em data.toptracks
    this.tracks = data.toptracks.track
    this.attr = data.toptracks["@attr"]
  }
}

export interface TrackDataLastFm {
  artist: string,
  name: string,
  userplaycount?: string | number,
  url: string,
  mbid: string,
  date: DateRecentTracks
  key: string
}

interface ArtistRecentTracks {
  mbid: string,
  "#text": string
}

interface AlbumRecentTracks {
  mbid: string,
  "#text": string
  url?: string
}

interface DateRecentTracks {
  uts: string,
  "#text": string
}

export interface trackRecentData {
  artist: ArtistRecentTracks,
  streamable: string,
  image: LastFmImage,
  mbid: string,
  album: AlbumRecentTracks,
  name: string,
  "@attr"?: { nowplaying: string }
  url: string,
  date: DateRecentTracks
  playcount: string,
  key: string | ""
  userplaycount: string | number
}

interface Attr {
  user: string,
  totalPages: string,
  page: string,
  perPage: string,
  total: string
}


export interface RecentTracks {
  recenttracks: {
    track: trackRecentData[],
    "@attr"?: Attr
  }

  message?: string,
  error?: number

}

export interface RecentTracksAxiosResponse<T> {
  data: T
}

interface Tag {
  name: string,
  url: string
}

interface Wiki {
  published: string,
  summary: string
}

interface Track {
  name: string,
  mbid: string,
  url: string,
  duration: string,
  streamable: LastFmStreamable,
  listeners: string,
  playcount: string,
  artist: LastFmArtist,
  album: AlbumRecentTracks,
  image: LastFmImage[],
  userplaycount: string,
  userloved: string,
  toptags: Tag[],
  wiki: Wiki
}

export interface TrackWithPlaycount {
  track: Track
}

export interface UserPlaycount {
  user: string,
  trackName: string,
  trackArtist: string
}

export interface QuantityScrobbles {
  quantity: string
}

export interface topTracksAllTime {
  toptracks: {
    track:
    {
      streamable: LastFmStreamable,
      mbid: string,
      name: string,
      image: LastFmImage[],
      artist: LastFmArtist,
      url: string,
      duration: string,
      "@attr": Attr
    }[]
  },
  userplaycount?: string

}


export interface GetTracksByPercentage {
  track: trackRecentData,
  userplaycount: QuantityScrobbles
}


export interface getLastTimeMusicListened {
  track: TrackDataLastFm[],
  lastTimeListened: string[]
}

export interface Params {
  method: string,
  limit: string | number,
  user: string | LastFmFullProfile,
  from?: number,
  to?: number,
  api_key?: string,
  page?: number,
  format: string
}

export interface ApiStructured {
  userplaycount: string;
  artist: string;
  name: string;
  url: string;
  mbid: string;
  date: DateRecentTracks;
  key: string;
}

export const PercentageSchema = Joi.object().keys({

  percentage: Joi.string().valid(
    ...Object.keys(SearchFor)
  ).required()

})

export const RediscoverSchema = Joi.object().keys({

  percentage: Joi.string().valid(
    ...Object.keys(SearchFor)
  ).required(),
  limit: Joi.number().min(1).max(200).required()
})

const DateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const isValid = dayjs(value, "YYYY-MM-DD", true).isValid()

    if (!isValid) {
      return helpers.error("any.invalid")
    }

    return value
  })
  .messages({
    "string.pattern.base": "Date must be in format YYYY-MM-DD",
    "any.invalid": "Date does not exist in calendar"
  })

export const rediscoverLovedTracks = Joi.object({
  limit: Joi.number().integer().min(5).max(200).required(),
  fetchInDays: Joi.number().integer().min(10).max(365).default(30),
  distinct: Joi.alternatives()
    .try(
      Joi.boolean().valid(false),
      Joi.number().integer().min(1)
    )
    .default(false),
  maximumScrobbles: Joi.alternatives()
    .try(
      Joi.boolean().valid(false),
      Joi.number().integer().min(10)
    ),
  from: DateSchema,
  to: DateSchema,
  searchPeriodFrom: DateSchema,
  searchPeriodTo: DateSchema
})

export type RediscoverLovedTracksQuery = {
  limit: number;
  fetchInDays: number;
  distinct: false | number;
  maximumScrobbles: false | number,
  searchPeriodFrom: false | string,
  searchPeriodTo: false | string
};

