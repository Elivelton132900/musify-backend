import { Joi } from "celebrate";

export enum SearchFor {
  early_days = 5,
  old_times = 15,
  mid_years = 50,
}

export const RecentYears = 85;

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
  userplaycount: string,
  url: string,
  mbid: string
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

interface trackRecentData {
  artist: ArtistRecentTracks,
  streamable: string,
  image: LastFmImage,
  mbid: string,
  album: AlbumRecentTracks,
  name: string,
  "@attr"?: { nowplaying: boolean }
  url: string,
  date?: DateRecentTracks
  playcount: string,
  userplaycount: string
}

interface Attr {
  user: string,
  totalPages: string,
  page: string,
  perPage: string,
  total: string
}


export interface RecentTracks {
  data: {
    recenttracks: {
      track: trackRecentData[],
      "@attr"?: Attr
    }
  }
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

export interface Playcount {
  track: Track
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