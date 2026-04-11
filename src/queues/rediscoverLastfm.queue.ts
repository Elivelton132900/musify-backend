import { Queue, QueueEvents } from "bullmq";
import { redis } from "../infra/redis";

export const rediscoverLastFmQueue =  new Queue(
    "rediscover-loved-tracks-last-fm",
    {connection: redis}
)

export const rediscoverLastFmQueueEvents = new QueueEvents("rediscover-loved-tracks-last-fm", {
    connection: redis
})
