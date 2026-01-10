import { Request, Response } from "express"
import { LastFmService } from "../services/last-fm.service"
import { RediscoverLovedTracksQuery,  } from "../models/last-fm.model"


export class LastFmController {


static async rediscoverLovedTracks(req: Request, res: Response) {
  const controller = new AbortController()
  const { signal } = controller

  req.on("close", () => {
    controller.abort()
  })

  try {
    const lastFmService = new LastFmService()

    const userLastFm = req.session.lastFmSession?.user as string
    const query = req.query as unknown as RediscoverLovedTracksQuery

    const {
      limit,
      fetchInDays,
      distinct,
      maximumScrobbles,
      candidateFrom,
      candidateTo,
      comparisonFrom,
      comparisonTo,
      minimumScrobbles,
      order
    } = query

    
    const response = await lastFmService.rediscoverLovedTracks(
      userLastFm,
      {
        limit,
        fetchInDays,
        distinct,
        maximumScrobbles,
        candidateFrom,
        candidateTo,
        comparisonFrom,
        comparisonTo,
        minimumScrobbles,
        order
      },
      signal
    )

    if (signal.aborted) return

    res.status(200).json({
      mostListenedMusic: response,
      musicsRetrieved: response.length
    })

    controller.abort()

  } catch (err: any) {
    if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
      console.log("🔕 Requisição cancelada")
      return
    }

    console.error(err)
    res.status(500).json({ error: "Internal server error" })
  }
}
}