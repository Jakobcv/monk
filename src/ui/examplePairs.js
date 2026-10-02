import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

// ✗/✓ examples, drawn as a set of panels side by side — for LiveMarkdown's `extensions`, on a page
// that teaches by example (the writing guide). The file is untouched: a run of quote lines that
// open on ✗ or ✓ is still `> ✗ …` / `> ✓ …` on disk, and only how it's shown changes.
//
// It follows the rule the rest of LiveMarkdown keeps for syntax markers: formatted everywhere the
// caret isn't. Off the run, the lines are replaced by one block of panels; put the caret in it — a
// click on a panel does that, at the start of the line it came from — and the raw lines come back to
// be edited, the way a `**` comes back on the line you're on.
//
// A run is consecutive `>` lines whose first line opens on ✗ or ✓. Each ✗ or ✓ line starts an
// example, and any further quote lines up to the next one are more of it (the Result example in the
// shipped guide runs on for five). A run whose first line isn't an example is an ordinary quote and
// is left alone. A field's name at the start of a paragraph — `**Problem.**` — is picked out too,
// since it's what a person scans a section for.

const QUOTE = /^>[ \t]?/;
const EXAMPLE = /^>[ \t]?([✗✓])[ \t]?/;
const FIELD_NAME = /^\*\*[^*\n]+\*\*/;

const setFocus = StateEffect.define();

// Inline markdown in an example, as DOM rather than HTML: `code` becomes a chip, **bold** and _em_
// keep their emphasis, and everything else is text — so nothing in the file is ever parsed as markup.
function inline(parent, text) {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(_[^_]+_|\*[^*]+\*)/g;
  let last = 0;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    const [tag, cls, inner] = m[1] ? ["code", "md-code", m[1].slice(1, -1)]
      : m[2] ? ["strong", "md-strong", m[2].slice(2, -2)] : ["em", "md-em", m[3].slice(1, -1)];
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = inner;
    parent.append(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

class ExamplesWidget extends WidgetType {
  // items: [{ good, lines: [text…], pos }] — `pos` is where the caret goes when it's clicked.
  constructor(items) { super(); this.items = items; this.key = JSON.stringify(items); }
  eq(other) { return other.key === this.key; }
  // CodeMirror only measures what's on screen and estimates the rest; left to itself it takes a
  // block widget for one line, and a set of panels is several times that. Off by that much, every
  // jump down the page (the section map) lands short. Roughly: the tallest panel's text at ~45
  // characters a line, plus its heading and padding.
  get estimatedHeight() {
    const tallest = Math.max(...this.items.map((it) => it.lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 45)), 0)));
    return 60 + tallest * 22;
  }
  toDOM(view) {
    const set = document.createElement("div");
    set.className = "md-examples";
    for (const item of this.items) {
      const panel = document.createElement("div");
      panel.className = `md-example md-example--${item.good ? "good" : "bad"}`;
      const head = document.createElement("div");
      head.className = "md-example__head";
      const mark = document.createElement("span");
      mark.className = "md-example__mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = item.good ? "✓" : "✗";
      head.append(mark, item.good ? "Better" : "Avoid");
      panel.append(head);
      for (const line of item.lines) {
        const p = document.createElement("div");
        // A list line inside an example keeps its bullet as text — it's a quote of a field, not a
        // list on this page — but hangs it, so a wrapped line runs on under the words.
        const li = /^- /.test(line);
        p.className = !line.trim() ? "md-example__gap" : li ? "md-example__line md-example__line--li" : "md-example__line";
        inline(p, li ? `• ${line.slice(2)}` : line);
        panel.append(p);
      }
      panel.addEventListener("mousedown", (e) => {
        e.preventDefault();
        view.focus();
        view.dispatch({ selection: { anchor: item.pos } });
      });
      set.append(panel);
    }
    return set;
  }
  ignoreEvent() { return true; }
}

function build(state, focused) {
  const doc = state.doc;
  const active = new Set();
  if (focused) {
    for (const r of state.selection.ranges) {
      for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) active.add(n);
    }
  }
  const ranges = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!QUOTE.test(line.text)) {
      const field = FIELD_NAME.exec(line.text);
      if (field) ranges.push(Decoration.mark({ class: "md-field" }).range(line.from, line.from + field[0].length));
      continue;
    }
    // The whole run of quote lines starting here.
    let end = n;
    while (end < doc.lines && QUOTE.test(doc.line(end + 1).text)) end++;
    const first = EXAMPLE.exec(line.text);
    let touched = false;
    for (let k = n; k <= end; k++) if (active.has(k)) touched = true;
    if (first && !touched) {
      const items = [];
      for (let k = n; k <= end; k++) {
        const l = doc.line(k);
        const ex = EXAMPLE.exec(l.text);
        if (ex) items.push({ good: ex[1] === "✓", lines: [l.text.slice(ex[0].length)], pos: l.from + ex[0].length });
        else items[items.length - 1].lines.push(l.text.replace(QUOTE, ""));
      }
      ranges.push(Decoration.replace({ widget: new ExamplesWidget(items), block: true }).range(line.from, doc.line(end).to));
    }
    n = end;
  }
  return Decoration.set(ranges, true);
}

const examplesField = StateField.define({
  create: (state) => ({ focused: false, decorations: build(state, false) }),
  update(value, tr) {
    let focused = value.focused;
    for (const e of tr.effects) if (e.is(setFocus)) focused = e.value;
    if (!tr.docChanged && !tr.selection && focused === value.focused) return value;
    return { focused, decorations: build(tr.state, focused) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

export const examplePairs = [
  examplesField,
  EditorView.focusChangeEffect.of((state, focusing) => setFocus.of(focusing)),
];
