/**
 * Theme mode: system preference, inherited from the suite when deployed on
 * the same origin (radiobook.ca shares localStorage with radiobook.ca/trainer/),
 * or overridden in-app via ◐.
 *
 * Precedence: trainer's own choice > suite preference > system.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const TRAINERS_MODE_KEY = 'tartanleaf.trainer.mode';
const SUITE_PREFS_KEY = 'rg.suite.preferences';
const LEGACY_THEME_KEY = 'theme';

const system = (): ThemeMode =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

/** Read the suite's theme preference when the shared origin makes it visible. */
function suiteTheme(): ThemeMode | null {
  try {
    const raw = window.localStorage.getItem(SUITE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { theme?: string };
      if (parsed.theme && ['dark', 'light', 'system'].includes(parsed.theme)) {
        return parsed.theme as ThemeMode;
      }
    }
    // older suite versions stored the theme under a bare key
    const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy && ['dark', 'light', 'system'].includes(legacy)) {
      return legacy as ThemeMode;
    }
  } catch (e) {
    /* shared-origin not available (test env, standalone host) — fall through */
    void e;
  }
  return null;
}

function trainerMode(): ThemeMode | null {
  try {
    const raw = window.localStorage.getItem(TRAINERS_MODE_KEY);
    if (raw && ['dark', 'light', 'system'].includes(raw)) return raw as ThemeMode;
  } catch (e) {
    void e; // storage unavailable
  }
  return null;
}

/** Resolve the mode the app should render in (trainer → suite → system). */
export function initialThemeMode(): ThemeMode {
  const inherited = trainerMode() ?? suiteTheme();
  if (inherited && inherited !== 'system') return inherited;
  const suite = suiteTheme();
  if (suite === 'dark' || suite === 'light') return suite;
  return system();
}

/** Persisted in-app override; null clears the override (back to suite/system). */
export function storedTrainerMode(): ThemeMode | null {
  return trainerMode();
}

export function setTrainerMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(TRAINERS_MODE_KEY, mode);
  } catch (e) {
    void e; // storage unavailable — the session still gets the mode
  }
}

/** The ◐ button: cycle system → light → dark. Returns the new mode. */
export function cycleThemeMode(): ThemeMode {
  const current = document.documentElement.dataset.mode ?? initialThemeMode();
  const next: ThemeMode = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
  setTrainerMode(next);
  applyThemeMode(next);
  return next;
}

/** Apply a mode to the document; 'system' removes the override. */
export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  if (mode === 'system') delete document.documentElement.dataset.mode;
  else document.documentElement.dataset.mode = mode;
}

/** Mount-time hook: apply the initial mode with the full precedence. */
export function applyInitialThemeMode(): void {
  applyThemeMode(initialThemeMode());
}
