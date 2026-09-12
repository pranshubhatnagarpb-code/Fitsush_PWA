// Web Push subscribe flow for the weekly "log your progress" reminder.
// The actual weekly send happens server-side (send-progress-reminders edge
// function, triggered by pg_cron) — this file only handles a client opting
// in: registering the service worker, subscribing via the browser's Push
// API, and saving the subscription to push_subscriptions.
import { supabase } from "@/lib/supabase";

// Hardcoded rather than read from import.meta.env: this app's ".env" is
// actually a directory (see .env/.env), not a file, so Vite never loads any
// VITE_* vars from it — lib/supabase.ts hardcodes its Supabase URL/key for
// the same reason. This is the VAPID *public* key, which is meant to be
// public (sent to every subscribing browser), so hardcoding it is safe —
// unlike the matching private key, which only ever lives server-side as a
// Supabase Edge Function secret.
const VAPID_PUBLIC_KEY =
  "BEi4s_zrF0wwHHB6BVA-cK6GBJAZ6fwjBNVdjnMEbiHFFZAJvI9AgdtDdJWi0920epo-E-Dl8bmW79CBVojWyPQ";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  return isPushSupported() ? Notification.permission : "unsupported";
}

export async function isSubscribedToWeeklyReminders(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export async function subscribeToWeeklyReminders(clientId: string): Promise<{ error: string | null }> {
  if (!isPushSupported()) {
    return { error: "Push notifications aren't supported on this device or browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notification permission wasn't granted." };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { error: "Subscription was created without the expected keys." };
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        client_id: clientId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" },
    );
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to enable notifications." };
  }
}
