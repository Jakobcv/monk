// Opening a file the user attached (a source) without letting it run script as Monk.
//
// A blob: URL has the page's own origin. Opened in a tab, an HTML or SVG file's script would run
// on Monk's origin, where it can read the folder handle out of IndexedDB and — if permission is
// already granted this session — read and write the whole folder. So only types a browser shows
// inertly may open in a tab; everything else is downloaded, never navigated to.
//
// The type comes from the name's extension against this list, never from `file.type` (which the
// browser also guessed from the extension), and the bytes are re-wrapped in a Blob carrying that
// exact type so nothing is left for the browser to sniff. SVG is deliberately absent: as a
// top-level document it runs its scripts. (Sketches drawn through <img src=blob:> are fine — an
// <img> never runs script — and don't come through here.)
const TEXT = "text/plain;charset=utf-8";
const VIEWABLE = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  pdf: "application/pdf",
  txt: TEXT, md: TEXT, markdown: TEXT, csv: TEXT, json: TEXT,
};

const extensionOf = (name) => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
};

// Opens `file` in a new tab if its extension is on the list above, otherwise downloads it as
// `name`. Works the same for a real folder and the demo's in-memory one: both hand back a Blob.
export function openAttachedFile(file, name) {
  const type = VIEWABLE[extensionOf(name)];
  const url = URL.createObjectURL(new Blob([file], { type: type || "application/octet-stream" }));
  if (type) {
    window.open(url, "_blank", "noopener");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
