import { Plus, X } from "lucide-react";
import { font, INK, INK_FAINT, SIZE, WEIGHT, SPACE } from "./lib/theme";
import { eyebrow } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

const rowInput = {
  flex: 1, border: "none", borderBottom: "1px solid transparent", outline: "none", background: "none",
  fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.ui, color: INK, padding: "2px 0",
};

// Shared by Spec's Open Questions and Acceptance Criteria — no checklist UI exists elsewhere
// in the app yet, this is new. `items` is [{text, checked}], fully controlled by the parent.
export default function ChecklistEditor({ label, items, onChange }) {
  const patch = (idx, fields) => onChange(items.map((it, i) => (i === idx ? { ...it, ...fields } : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, { text: "", checked: false }]);

  return (
    <div>
      <div style={eyebrow}>{label}</div>
      <div style={{ marginTop: SPACE.base, display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
            <input
              type="checkbox"
              checked={!!item.checked}
              onChange={(e) => patch(idx, { checked: e.target.checked })}
              style={{ flexShrink: 0, cursor: "pointer" }}
            />
            <input
              value={item.text}
              onChange={(e) => patch(idx, { text: e.target.value })}
              placeholder="…"
              style={{ ...rowInput, textDecoration: item.checked ? "line-through" : "none", color: item.checked ? INK_FAINT : INK }}
            />
            <IconButton onClick={() => remove(idx)} title="Remove" danger style={{ flexShrink: 0 }}>
              <X size={13} />
            </IconButton>
          </div>
        ))}
      </div>
      <Button variant="subtle" onClick={add} style={{ marginTop: SPACE.md, marginLeft: "-6px" }}>
        <Plus size={12} /> Add
      </Button>
    </div>
  );
}
