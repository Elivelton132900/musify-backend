import { Queue, QueueEvents } from "bullmq";
import { redis } from "../infra/redis";

export const rediscoverQueue =  new Queue(
    "rediscover-loved-tracks",
    {connection: redis}
)

export const rediscoverQueueEvents = new QueueEvents("rediscover-loved-tracks", {
    connection: redis
})
