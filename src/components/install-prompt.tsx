// "Install the app" popup shown when the portal is opened in a browser tab.
// - Chrome / Edge / Android: uses the browser's beforeinstallprompt event, so
//   "Install" opens the native install dialog.
// - iOS Safari: there is no install API, so it shows Share → Add to Home
//   Screen instructions instead.
// Hidden when already running as an installed app, and for a few days after
// the client taps "Not now".
import * as React from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fitsush-install-dismissed-at";
const DISMISS_DAYS = 3;

// Captured at module load, not in an effect: Chrome can fire
// beforeinstallprompt before React has mounted, and it only fires once.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch support tells them apart.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // storage unavailable (private mode) — popup just shows again next visit
  }
}

// How this browser can install the app right now. Shared by the popup and
// the Profile page's "Install the app" card.
export type InstallMode = "native" | "ios" | "installed" | "unavailable";

export function useInstall(): { mode: InstallMode; install: () => Promise<"accepted" | "dismissed" | null> } {
  const [mode, setMode] = React.useState<InstallMode>("unavailable");

  React.useEffect(() => {
    if (isStandalone()) {
      setMode("installed");
      return;
    }
    if (isIos()) {
      setMode("ios");
      return;
    }
    const sync = () => setMode(deferredPrompt ? "native" : "unavailable");
    sync();
    promptListeners.add(sync);
    return () => {
      promptListeners.delete(sync);
    };
  }, []);

  const install = async () => {
    const evt = deferredPrompt;
    if (!evt) return null;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
    return outcome;
  };

  return { mode, install };
}

export function InstallPrompt() {
  const { mode: available, install: runInstall } = useInstall();
  const [dismissed, setDismissed] = React.useState(() => typeof window === "undefined" || recentlyDismissed());
  const mode = !dismissed && (available === "native" || available === "ios") ? available : null;

  const close = () => {
    rememberDismissed();
    setDismissed(true);
  };

  const install = async () => {
    const outcome = await runInstall();
    if (outcome === "dismissed") rememberDismissed();
    setDismissed(true);
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <img src="/icons/icon-192.png" alt="" className="mb-1 h-16 w-16 rounded-2xl border" />
          <DialogTitle>Install the Fitsush app</DialogTitle>
          <DialogDescription>
            Add Fitsush to your home screen for one-tap access to your diet plan, progress and
            reminders.
          </DialogDescription>
        </DialogHeader>

        {mode === "ios" ? (
          <ol className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Tap the <b>Share</b> button in Safari's toolbar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Choose <b>Add to Home Screen</b>, then tap <b>Add</b>
              </span>
            </li>
          </ol>
        ) : null}

        <div className="flex flex-col gap-2">
          {mode === "native" ? (
            <button
              type="button"
              onClick={install}
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:bg-primary/90 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-transform hover:bg-muted active:scale-95"
          >
            {mode === "ios" ? "Got it" : "Not now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
