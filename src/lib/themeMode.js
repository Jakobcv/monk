// Which of the two palettes is in force, and who decides.
//
// The theme belongs to the person, not to the workspace: it lives in this browser profile and
// follows them into every folder they connect, rather than travelling with a repo and arriving
// in someone else's commit.
//
// "system" is the *absence* of a stored value rather than a third stored state. That way a person
// who has never opened Settings and a person who set it back to System behave identically, and
// following the desktop is one code path rather than two.

export const THEME_MODES = ["light", "dark", "system"];
const KEY = "monk:theme";

// localStorage throws rather than returning null in a private window, and can be blocked outright.
// Neither is an error worth showing anyone: the theme falls back to the desktop's, and a choice
// made in that session holds until the tab is reloaded.
export function readThemeMode() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

// The palette itself lives in lib/theme.js, which defines both sets of custom properties: one on
// :root, one under prefers-color-scheme, and one per [data-theme] for when a person has overridden
// the desktop. So all this has to do is say which, and the browser repaints.
export function applyThemeMode(mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  syncThemeColor(mode);
}

export function writeThemeMode(mode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* private mode, or storage blocked — the choice holds for this session and is forgotten on reload */
  }
  applyThemeMode(mode);
}

// The browser UI around the page. index.html ships a <meta name="theme-color"> per scheme so the
// first paint is right before any script runs; once a person overrides the desktop, those media
// conditions are answering the wrong question, so they get switched on and off by hand instead.
function syncThemeColor(mode) {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length < 2) return;
  for (const meta of metas) {
    const isDark = (meta.dataset.scheme || meta.media).includes("dark");
    if (!meta.dataset.scheme) meta.dataset.scheme = isDark ? "dark" : "light";
    if (mode === "system") meta.media = `(prefers-color-scheme: ${meta.dataset.scheme})`;
    else meta.media = meta.dataset.scheme === mode ? "all" : "not all";
  }
}
