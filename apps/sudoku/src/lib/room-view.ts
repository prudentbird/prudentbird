import type { FunctionReturnType } from "convex/server";
import type { api } from "~/convex/_generated/api";

/** The `status: "ok"` branch of `api.rooms.get`. */
export type RoomView = Extract<
  FunctionReturnType<typeof api.rooms.get>,
  { status: "ok" }
>;

/** The `status: "ok"` branch of `api.daily.get`. */
export type DailyView = Extract<
  FunctionReturnType<typeof api.daily.get>,
  { status: "ok" }
>;
