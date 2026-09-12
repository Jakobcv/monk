import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { INK_FAINT, BORDER, SPACE, METHOD_OPTIONS } from "./lib/theme";
import { Eyebrow, PageTitle } from "./ui/text";
import Breadcrumbs from "./Breadcrumbs";
import SignalCard from "./SignalCard";
import Button from "./ui/Button";
import Field from "./ui/Field";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import DialogActions from "./ui/DialogActions";
import { blankSignal, signalsForActivity } from "./lib/signalModel";
import Page from "./ui/Page";

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

  // Anything not linked when the page opened is an arrival — it animates in and takes focus
  // once the create modal saves.
  const [presentOnMount] = useState(() => new Set(linked.map((s) => s.id)));
  const [focusId, setFocusId] = useState(null);

  // Non-null while the create modal is open — the draft, built off blankSignal() (already
  // pointed at this activity as its source) the moment it opens. Mirrors Research Repository.
  const [newSignal, setNewSignal] = useState(null);
  const openSignalForm = () => setNewSignal({ ...blankSignal(), source: { type: "activity", activityId: activity.id } });
  const closeSignalForm = () => setNewSignal(null);
  const saveSignalForm = () => { onCreateSignal(newSignal); setFocusId(newSignal.id); closeSignalForm(); };

  return (
    <Page header={<Breadcrumbs items={breadcrumbs} />}>
      <div className="enter-up" style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
        <PageTitle
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled activity"
        />

        <div style={{ display: "flex", gap: SPACE.lg, flexWrap: "wrap" }}>
          <div className="select-wrap" style={{ width: "200px" }}>
            <select
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ color: method ? undefined : INK_FAINT }}
            >
              <option value="">Method</option>
              {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown size={12} className="select-chevron" />
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
            <Eyebrow>Linked signals ({linked.length})</Eyebrow>
            <Button onClick={openSignalForm}>
              <Plus size={16} /> Add signal
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
                <div key={sig.id} className={presentOnMount.has(sig.id) ? undefined : "enter-up"}>
                  <SignalCard
                    signal={sig}
                    activities={activities}
                    activityLink={false}
                    autoFocus={focusId === sig.id}
                    onChange={(patch) => onUpdateSignal(sig.id, patch)}
                    onDelete={() => onDeleteSignal(sig.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: "1px", backgroundColor: BORDER }} />

        <Button variant="danger" onClick={onDelete} style={{ alignSelf: "flex-start" }}>
          <Trash2 size={16} /> Delete activity
        </Button>
      </div>

      {newSignal && (
        // Cmd/Ctrl+Enter saves — plain Enter types into the observation. Modal owns Escape.
        <Modal title="New signal" onClose={closeSignalForm}>
          <div onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveSignalForm(); } }}>
            <SignalCard
              autoFocus
              signal={newSignal}
              activities={activities}
              activityLink={false}
              onChange={(patch) => setNewSignal((s) => ({ ...s, ...patch }))}
            />
            <DialogActions onCancel={closeSignalForm} onSave={saveSignalForm} />
          </div>
        </Modal>
      )}
    </Page>
  );
}
