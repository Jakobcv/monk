import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { INK_FAINT, BORDER, SPACE, METHOD_OPTIONS } from "./lib/theme";
import { eyebrow, pageTitleInput } from "./ui/text";
import Breadcrumbs from "./Breadcrumbs";
import SignalCard from "./SignalCard";
import Button from "./ui/Button";
import Field from "./ui/Field";
import EmptyState from "./ui/EmptyState";
import { blankSignal, signalsForActivity } from "./lib/signalModel";

// `activity` only seeds local state on mount — the parent remounts this page (via
// `key={activity.id}`) whenever the open activity changes, same pattern as SpecPage/Board.
// "Linked signals" is never stored on the activity itself — it's every signal (from the
// global `signals` list) whose `source` points back here (see signalModel.js), so adding one
// from this page just creates a signal with that source and it shows up automatically.
export default function ActivityPage({ activity, signals, activities, onChange, onDelete, onCreateSignal, onUpdateSignal, onDeleteSignal, breadcrumbs }) {
  const [name, setName] = useState(activity.name);
  const [method, setMethod] = useState(activity.method);
  const [link, setLink] = useState(activity.link);
  const [date, setDate] = useState(activity.date);
  const [author, setAuthor] = useState(activity.author);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ name, method, link, date, author });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, method, link, date, author]);

  const linked = signalsForActivity(signals, activity.id);

  const addSignal = () => {
    onCreateSignal({ ...blankSignal(), source: { type: "activity", activityId: activity.id } });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Breadcrumbs items={breadcrumbs} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", boxSizing: "border-box", padding: `${SPACE["3xl"]} ${SPACE["5xl"]} ${SPACE["5xl"]}` }}>
        <div className="enter-up" style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled activity"
            style={pageTitleInput}
          />

          <div style={{ display: "flex", gap: SPACE.lg, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Field
                as="select" size="ui" value={method} onChange={(e) => setMethod(e.target.value)}
                style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", padding: "6px 26px 6px 9px", width: "200px", cursor: "pointer" }}
              >
                <option value="">Method</option>
                {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Field>
              <ChevronDown size={12} style={{ position: "absolute", right: SPACE.base, top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
            </div>
            <Field size="ui" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link" style={{ flex: 1, minWidth: "220px" }} />
            <Field
              size="ui" type="date"
              value={date ? new Date(date).toISOString().slice(0, 10) : ""}
              onChange={(e) => setDate(e.target.value ? new Date(e.target.value).getTime() : Date.now())}
            />
            <Field size="ui" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" style={{ width: "160px" }} />
          </div>

          <div style={{ height: "1px", backgroundColor: BORDER }} />

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
              <div style={eyebrow}>Linked signals ({linked.length})</div>
              <Button onClick={addSignal}>
                <Plus size={12} /> Add signal
              </Button>
            </div>

            {linked.length === 0 ? (
              <EmptyState compact>No signals collected yet.</EmptyState>
            ) : (
              // Same card as a Discovery board's — same tint, same quiet inline fields, same
              // corner delete — via the shared SignalCard. A signal should look like a signal
              // wherever you meet it.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg }}>
                {linked.map((sig) => (
                  <SignalCard
                    key={sig.id}
                    signal={sig}
                    activities={activities}
                    onChange={(patch) => onUpdateSignal(sig.id, patch)}
                    onDelete={() => onDeleteSignal(sig.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ height: "1px", backgroundColor: BORDER }} />

          <Button variant="danger" onClick={onDelete} style={{ alignSelf: "flex-start" }}>
            <Trash2 size={13} /> Delete activity
          </Button>
        </div>
      </div>
    </div>
  );
}
