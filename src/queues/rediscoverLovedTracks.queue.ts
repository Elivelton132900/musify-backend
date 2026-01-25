import { Queue } from "bullmq";
import { redis } from "../infra/redis";

export const rediscoverQueue = new Queue(
    "rediscover-loved-tracks",
    {connection: redis}
)