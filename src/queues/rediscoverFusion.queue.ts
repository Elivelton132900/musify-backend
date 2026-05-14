import { Queue, QueueEvents } from "bullmq"
import { redis } from "../infra/redis"

export const rediscoverFusionQueue = new Queue("rediscover-fusion", {
    connection: redis,
})

export const rediscoverFusionQueueEvents = new QueueEvents("rediscover-fusion", {
    connection: redis,
})
