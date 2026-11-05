/**
 * Global keyboard dispatch: one listener at a time per component, with the
 * input-safe guard shared across the app (typing in the bank chooser or any
 * form control must never trigger a study action).
 */
export type KeyHandler = (e: KeyboardEvent) => void;

/** True when the event should be ignored because focus sits in a form control. */
export function inFormControl(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  const tagBlocks = tag === 'input' || tag === 'select' || tag === 'textarea';
  return Boolean(tagBlocks || e.metaKey || e.ctrlKey || e.altKey);
}

/**
 * Attach a window keydown handler; returns the unsubscribe function for the
 * component's disconnectedCallback.
 */
export function onWindowKey(handler: KeyHandler): () => void {
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
