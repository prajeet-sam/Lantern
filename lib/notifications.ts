"use client";

export type NotificationStatus = "unsupported" | NotificationPermission;

export interface ReminderSpec {
  id: string;
  title: string;
  body: string;
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationStatus(): NotificationStatus {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function sendReminder(spec: ReminderSpec): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return false;
  }
  const options: NotificationOptions = {
    body: spec.body,
    tag: spec.id,
    icon: "/icons/icon-192.png",
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(spec.title, { ...options, renotify: true } as NotificationOptions);
        return true;
      }
    }
    new Notification(spec.title, options);
    return true;
  } catch {
    return false;
  }
}

export function reminderFiredOn(today: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("lantern:reminders") || "{}")[
      today
    ] || {};
  } catch {
    return {};
  }
}

export function markReminderFired(today: string, id: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem("lantern:reminders") || "{}");
    all[today] = { ...(all[today] || {}), [id]: true };
    window.localStorage.setItem("lantern:reminders", JSON.stringify(all));
  } catch {
    /* ignore */
  }
}