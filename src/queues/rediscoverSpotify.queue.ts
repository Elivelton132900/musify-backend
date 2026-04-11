import { Queue, QueueEvents } from "bullmq";
import { redis } from "../infra/redis";

export const rediscoverSpotifyQueue =  new Queue(
    "rediscover-loved-tracks-spotify",
    {connection: redis}
)

export const rediscoverSpotifyQueueEvents = new QueueEvents("rediscover-loved-tracks-last-fm", {
    connection: redis
})
