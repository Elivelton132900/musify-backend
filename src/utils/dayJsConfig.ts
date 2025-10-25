import timezone from "dayjs/plugin/timezone";
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc";

dayjs.extend(utc)
dayjs.extend(timezone)

export { dayjs }
