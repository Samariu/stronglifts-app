// System notifications for the rest timer.
//
// On iOS these only exist for a PWA installed to the Home Screen (16.4+), the
// permission prompt must come from a real tap, and the notification has to be
// raised through the service worker — the `new Notification()` constructor is
// not implemented there. Everything below degrades to a no-op rather than
// throwing when any of that is missing.

const ICON = `${import.meta.env.BASE_URL}pwa-192.png`;

export const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

/** Installed to the Home Screen / launched standalone — required by iOS. */
export const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
};

/** 'unsupported' | 'default' | 'granted' | 'denied' */
export const getPermission = () =>
  (isNotificationSupported() ? Notification.permission : 'unsupported');

/** Must be called synchronously from a user gesture on iOS. */
export const requestPermission = async () => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

// In dev there may be no service worker at all, and `serviceWorker.ready` never
// settles in that case — cap the wait so the fallback can take over.
const readyRegistration = async (timeoutMs = 3000) => {
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
};

/**
 * Raise the "rest is over" notification. `late` marks the catch-up case, where
 * the rest ended while the app was suspended in the background.
 * Resolves true only if something was actually shown.
 */
export const notifyRestDone = async ({ late = false } = {}) => {
  if (getPermission() !== 'granted') return false;

  const title = late ? 'Rest finished' : 'Rest complete';
  const options = {
    body: late ? 'Your rest ended while the app was in the background.' : 'Time for your next set.',
    icon: ICON,
    badge: ICON,
    tag: 'rest-timer',      // collapse duplicates rather than stacking banners
    renotify: true,
    silent: false,
  };

  const registration = await readyRegistration();
  if (registration) {
    try {
      await registration.showNotification(title, options);
      return true;
    } catch { /* fall through to the constructor */ }
  }

  try {
    new Notification(title, options); // desktop dev fallback; not available on iOS
    return true;
  } catch {
    return false;
  }
};
