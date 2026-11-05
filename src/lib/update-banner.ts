/**
 * Service-worker update detection.
 *
 * The PWA precaches the shell, so after a new deploy the app still serves the
 * old shell until it reloads (registerType:'autoUpdate' activates the new SW
 * in the background). This watcher knows when a NEW service worker has taken
 * control of an already-controlled page — the one moment a "reload to get the
 * new version" toast is correct — and surfaces it to the caller.
 */
export interface ServiceWorkerLike {
  readonly controller: unknown;
  getRegistration(): Promise<{ waiting: unknown } | undefined | null>;
  addEventListener(type: 'controllerchange', fn: () => void): void;
}

export function watchForServiceWorkerUpdate(
  callback: () => void,
  sw: ServiceWorkerLike | undefined = (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
    ? navigator.serviceWorker as unknown as ServiceWorkerLike
    : undefined,
): void {
  if (!sw) return;

  // A controller on a previous page load means any controllerchange from
  // here on is a NEW worker taking over — never the very first install.
  let hadController = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (hadController) callback();
    else hadController = true;
  });

  // Cold start with a worker already WAITING: it activates behind this page
  // (clientsClaim), so the page is running the old shell right now.
  void sw.getRegistration()
    .then(reg => { if (reg?.waiting) callback(); })
    .catch(() => undefined);
}
