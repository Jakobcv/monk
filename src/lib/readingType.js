// Which typeface a person's own words are set in: the app's sans, or a serif.
//
// Like the theme (lib/themeMode.js), this belongs to the person rather than the workspace. It lives
// in this browser profile and follows them into every folder, and it never lands in a commit for
// someone else to open.
//
// "sans" is the *absence* of a stored value, the same way "system" is for the theme. Someone who
// has never opened Settings and someone who switched back behave identically, and there is one code
// path for the default rather than two.

export const READING_TYPES = ["sans", "serif"];
const KEY = "monk:reading";

// localStorage throws rather than returning null in a private window, and can be blocked outright.
// Neither is worth an error: the words stay in the sans, and a choice made in that session holds
// until the tab is reloaded.
export function readReadingType() {
  try {
    return localStorage.getItem(KEY) === "serif" ? "serif" : "sans";
  } catch {
    return "sans";
  }
}

// The two typefaces are defined in lib/theme.js as --font-reading, with a [data-reading="serif"]
// block that swaps it. All this has to do is set the attribute, and the browser repaints.
export function applyReadingType(type) {
  const root = document.documentElement;
  if (type === "serif") root.setAttribute("data-reading", "serif");
  else root.removeAttribute("data-reading");
}

export function writeReadingType(type) {
  try {
    if (type === "serif") localStorage.setItem(KEY, "serif");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode, or storage blocked — the choice holds for this session and is forgotten on reload */
  }
  applyReadingType(type);
}
