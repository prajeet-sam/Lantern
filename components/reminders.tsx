"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useCycle } from "@/lib/use-cycle";
import { sendReminder, reminderFiredOn, markReminderFired } from "@/lib/notifications";

/**
 * Best-effort reminder runner. On mount (and when data/settings change) it checks
 * the user's reminder preferences and fires at most one notification of each kind
 * per calendar day. It never sets React state; it only reads conditions.
 */
export function RemindersGate() {
  const { ready, settings, logs } = useStore();
  const { prediction, today, todayHasPeriod, nextPeriodInDays } = useCycle();

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const fired = reminderFiredOn(today);
    const prettyMode = settings.notificationPrivacy === "private";

    const fire = (id: string, title: string, body: string) => {
      if (fired[id]) return;
      void (async () => {
        const ok = await sendReminder({ id, title, body });
        if (ok) markReminderFired(today, id);
      })();
    };

    if (settings.notifyPeriod) {
      const imminent =
        nextPeriodInDays !== undefined && nextPeriodInDays >= 0 && nextPeriodInDays <= 1;
      if (imminent && !todayHasPeriod && prediction.available) {
        void fire(
          "period",
          "A little reminder from Lantern ✨",
          prettyMode
            ? "A gentle heads up from your cycle tracker."
            : "Your period may be starting soon, based on recent history."
        );
      }
    }

    if (settings.notifyFlow && todayHasPeriod) {
      const loggedToday = logs.some((l) => l.date === today && l.flow && l.flow !== "none");
      if (!loggedToday) {
        void fire(
          "flow",
          "A little reminder from Lantern ✨",
          prettyMode ? "A gentle nudge to log today." : "Remember to log today's flow."
        );
      }
    }

    if (settings.notifyCheckIn) {
      if (!logs.some((l) => l.date === today)) {
        void fire(
          "checkin",
          "A little reminder from Lantern ✨",
          prettyMode ? "A gentle nudge to check in today." : "A quiet invite to log how today feels."
        );
      }
    }
  }, [ready, settings, logs, today, todayHasPeriod, nextPeriodInDays, prediction.available]);

  return null;
}