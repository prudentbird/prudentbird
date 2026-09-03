import posthog from "posthog-js";

export type Mode = "solo" | "coop" | "versus" | "daily";

export type AnalyticsEvents = {
  game_started: { mode: Mode; difficulty: string; is_guest: boolean };
  game_completed: {
    mode: Mode;
    difficulty: string;
    is_guest: boolean;
    duration_ms: number;
    mistakes: number;
    hints: number;
  };
  game_abandoned: {
    mode: Mode;
    difficulty: string;
    is_guest: boolean;
    duration_ms: number;
    filled: number;
    total_blanks: number;
  };
  hint_used: { mode: Mode; difficulty: string; is_guest: boolean };
  sign_in_clicked: { callback_url: string };
  signed_out: Record<string, never>;
  invite_link_copied: { code: string };
  daily_result_shared: { date: string; method: "share" | "clipboard" };
  theme_toggled: { theme: "light" | "dark" };
  room_join_submitted: { code: string };
};

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
) {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}

export function identify(userId: string) {
  if (!posthog.__loaded || posthog.get_distinct_id() === userId) return;
  posthog.identify(userId);
}

export function resetIdentity() {
  if (!posthog.__loaded) return;
  posthog.reset();
}
