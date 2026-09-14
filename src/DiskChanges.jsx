import { useEffect, useRef } from "react";
import { History } from "lucide-react";
import { font, INK_SOFT, INK_FAINT, SIZE, SPACE, WEIGHT } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import Button from "./ui/Button";

const KIND_LABEL = {
  spec: "Spec", section: "Section", signal: "Signal", insight: "Insight",
  activity: "Activity", initiative: "Initiative", researchPlan: "Research plan", workspaceDoc: "Workspace file",
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// The files an agent, an editor or a git checkout changed in the folder this session — the detail
// behind the "Updated n files from disk" toast. Session-only and newest first: it answers "what
// did that just change?", not "what is the history of this repo" (git has that).
//
// `log` is [{ id, at, files }] with `files` from lib/diskLog.js. Open state is owned by the app,
// because the toast's "Show" opens it too. Nothing renders until there is something to show.
export default function DiskChanges({ log, open, onOpenChange, hrefFor }) {
  const wrapRef = useRef(null);

  // Escape and a press outside close it. Not useDismiss: that also closes on any scroll, and this
  // panel scrolls.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onOpenChange(false); };
    const onPointerDown = (e) => {
      if (e.target.closest?.("[data-dismiss-ignore]")) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  if (!log.length) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Button
        variant="subtle"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        title="Files changed on disk by something other than Monk, this session"
      >
        <History size={16} /> Disk changes
      </Button>

      {open && (
        <div className="popover enter-up disk-log" role="dialog" aria-label="Disk changes">
          <div style={{ padding: "4px 6px 6px" }}>
            <Eyebrow>Changed on disk this session</Eyebrow>
          </div>
          {log.map((entry) => (
            <section key={entry.id} className="disk-log__entry" style={{ padding: "8px 6px" }}>
              <div style={{ fontFamily: font, fontSize: SIZE.xs, color: INK_FAINT, fontVariantNumeric: "tabular-nums", marginBottom: SPACE.sm }}>
                {timeFormat.format(entry.at)} · {entry.files.length} file{entry.files.length === 1 ? "" : "s"}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {entry.files.map((f) => {
                  const href = !f.removed && f.kind ? hrefFor(f.kind, f.id) : null;
                  const inner = (
                    <>
                      <span style={{ display: "block", fontFamily: font, fontSize: SIZE.sm }}>
                        {f.kind && <span style={{ color: INK_SOFT, fontWeight: WEIGHT.medium }}>{KIND_LABEL[f.kind]}{f.title ? " · " : ""}</span>}
                        {f.title}
                        {f.removed && <span style={{ color: INK_FAINT }}>{f.kind ? " — removed" : "Removed"}</span>}
                      </span>
                      <span translate="no" style={{ display: "block", fontFamily: MONO, fontSize: SIZE.xs, color: INK_FAINT, marginTop: "1px" }}>
                        {f.path}
                      </span>
                    </>
                  );
                  return (
                    <li key={f.path}>
                      {href
                        ? <a className="disk-log__file" href={href} onClick={() => onOpenChange(false)}>{inner}</a>
                        : <div className="disk-log__file">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
