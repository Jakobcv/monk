import { useState, useRef, useCallback, useEffect } from "react";

// Copy text to the clipboard, with a transient `copied` flag for button feedback. If the
// clipboard write is refused (no permission, document not focused), fall back to opening the
// text in a new tab so it's still reachable — this app runs in a browser sandbox with no way
// to hand a file to the OS, so a blob tab is the best fallback there is.
//
//   const [copied, copy] = useCopy();
//   <button onClick={() => copy(text)}>{copied ? "Copied" : "Copy"}</button>
export function useCopy(resetMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback((text) => {
    const markCopied = () => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(markCopied, () => openInTab(text));
    } else {
      openInTab(text);
    }
  }, [resetMs]);

  return [copied, copy];
}

function openInTab(text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
