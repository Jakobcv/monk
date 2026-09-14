import { useEffect, useRef, useState } from "react";
import { Plus, X, Link2 } from "lucide-react";
import { SPACE } from "./lib/theme";
import { isQuestionAnswered } from "./lib/researchPlanModel";
import { Eyebrow, Meta } from "./ui/text";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import LiveMarkdown from "./ui/LiveMarkdown";
import LinkPicker from "./ui/LinkPicker";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

const oneLine = (s) => s.replace(/\r?\n/g, " ");
const clip = (text, n = 60) => {
  const t = (text || "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

// A research plan's questions, on paper. Built on ChecklistEditor's rows (.cl-row, .cl-body,
// .cl-row__side, the same enter/exit and local row ids) with one difference that matters: there is
// no checkbox. A question is answered when an insight that answers it is linked, so the gutter
// shows that state rather than asking for it, and it can't claim an answer the evidence doesn't
// have. The linked insights sit under the question as chips.
//
// `items` is [{text, insightIds}], fully controlled by the parent. `insightHref(insight)` is where a
// chip goes — insights have no page of their own, so the app sends it to the repository.
export default function ResearchQuestionsEditor({ items, onChange, insights, insightHref }) {
  const idState = useRef();
  if (!idState.current) {
    let seq = 0;
    idState.current = { ids: items.map(() => seq++), next: () => seq++ };
  }
  const ids = idState.current.ids;

  const latest = useRef({ items, onChange });
  useEffect(() => { latest.current = { items, onChange }; });

  const [entering, setEntering] = useState(() => new Set());
  const [exiting, setExiting] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);

  // The row whose "link an insight" picker is open, and the button it hangs off.
  const [pickerFor, setPickerFor] = useState(null);
  const anchorRef = useRef(null);

  const patch = (idx, fields) => onChange(items.map((it, i) => (i === idx ? { ...it, ...fields } : it)));

  const add = () => {
    const id = idState.current.next();
    idState.current.ids = [...ids, id];
    setFocusId(id);
    setEntering((p) => new Set(p).add(id));
    setTimeout(() => setEntering((p) => { const n = new Set(p); n.delete(id); return n; }), ENTER_MS);
    onChange([...items, { text: "", insightIds: [] }]);
  };

  const remove = (id) => {
    setExiting((p) => (p.has(id) ? p : new Set(p).add(id)));
    setTimeout(() => {
      const at = idState.current.ids.indexOf(id);
      if (at !== -1) {
        idState.current.ids = idState.current.ids.filter((x) => x !== id);
        latest.current.onChange(latest.current.items.filter((_, i) => i !== at));
      }
      setExiting((p) => { const n = new Set(p); n.delete(id); return n; });
    }, EXIT_MS);
  };

  const link = (idx, insightId) => {
    const current = items[idx]?.insightIds || [];
    if (!current.includes(insightId)) patch(idx, { insightIds: [...current, insightId] });
  };
  const unlink = (idx, insightId) => patch(idx, { insightIds: (items[idx]?.insightIds || []).filter((x) => x !== insightId) });

  const answered = items.filter(isQuestionAnswered).length;
  const pickerIdx = pickerFor == null ? -1 : ids.indexOf(pickerFor);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.lg }}>
        <Eyebrow>Research questions</Eyebrow>
        {items.length > 0 && (
          <Meta style={{ fontVariantNumeric: "tabular-nums" }}>{answered} of {items.length} answered</Meta>
        )}
      </div>
      <div className="cl-rows" style={{ marginTop: SPACE.base }}>
        {items.map((item, idx) => {
          const id = ids[idx];
          const isAnswered = isQuestionAnswered(item);
          const linked = (item.insightIds || []).map((iid) => (insights || []).find((ins) => ins.id === iid)).filter(Boolean);
          const cls = "cl-row reveal-group"
            + (entering.has(id) ? " cl-row--enter" : "")
            + (exiting.has(id) ? " cl-row--exit" : "");
          return (
            <div key={id} className={cls} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base }}>
              <span
                className={`cl-check rq-marker${isAnswered ? " rq-marker--answered" : ""}`}
                role="img"
                aria-label={isAnswered ? "Answered" : "Not answered yet"}
                title={isAnswered ? "Answered — an insight is linked" : "Not answered yet — link an insight that answers it"}
              >
                <span className="rq-marker__dot" aria-hidden="true" />
              </span>
              <div className="cl-body">
                <LiveMarkdown
                  singleLine
                  autoFocus={focusId === id}
                  value={item.text}
                  onChange={(v) => patch(idx, { text: oneLine(v) })}
                  placeholder="What do we need to find out…"
                  ariaLabel="Research question"
                  className="cl-input"
                />
                {linked.length > 0 && (
                  <div className="rq-chips">
                    {linked.map((ins) => (
                      <span key={ins.id} className="rq-chip">
                        <a className="rq-chip__label" href={insightHref(ins)} title={ins.text}>
                          <span>{clip(ins.text) || "(empty insight)"}</span>
                        </a>
                        <button type="button" className="rq-chip__remove" onClick={() => unlink(idx, ins.id)} aria-label="Unlink this insight" title="Unlink">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="cl-row__side">
                <IconButton
                  className="reveal"
                  data-dismiss-ignore
                  aria-expanded={pickerFor === id}
                  onClick={(e) => {
                    if (pickerFor === id) { setPickerFor(null); return; }
                    anchorRef.current = e.currentTarget;
                    setPickerFor(id);
                  }}
                  title="Link an insight that answers this"
                  aria-label="Link an insight that answers this question"
                  style={{ "--hit-w": "30px", "--hit-h": "28px" }}
                >
                  <Link2 size={15} />
                </IconButton>
                <IconButton className="reveal" onClick={() => remove(id)} title="Remove" aria-label="Remove this question" danger style={{ "--hit-w": "34px", "--hit-h": "28px" }}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "2px" }}>
        <PaperButton icon={Plus} onClick={add}>Add question</PaperButton>
      </div>

      {pickerIdx !== -1 && (
        <LinkPicker
          anchorRef={anchorRef}
          onClose={() => setPickerFor(null)}
          label="Link an insight"
          placeholder="Search insights…"
          emptyText="No insights to link yet — form one from signals in the Research Repository."
          items={(insights || [])
            .filter((ins) => !(items[pickerIdx].insightIds || []).includes(ins.id))
            .map((ins) => ({ id: ins.id, label: ins.text || "(empty insight)" }))}
          onPick={(insightId) => link(pickerIdx, insightId)}
        />
      )}
    </div>
  );
}
