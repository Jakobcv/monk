import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Annotation, EditorSelection, EditorState, Prec } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, placeholder as placeholderText } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, Language, LanguageSupport, defineLanguageFacet, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { GFM, parser as markdownParser } from "@lezer/markdown";
import { tags as t } from "@lezer/highlight";

// Markdown that formats as you type: **bold** turns bold, a `# ` line grows, `code` becomes a chip.
// The value is still the raw markdown string, character for character — nothing is converted, so
// what's on disk is exactly what was typed, and an agent reading the file sees the same.
//
// This is CodeMirror 6 with markdown decorations, not a WYSIWYG document model. The app had one of
// those (Milkdown Crepe) and dropped it: 205 packages, a 1.77 MB bundle, and a document model that
// owned the string. CodeMirror is a fraction of that and edits the text itself.
//
// The syntax markers (**, _, `, # , > , the (url) of a link, a --- rule) are hidden except on the
// line the cursor is on, and everywhere while the field isn't focused — so text reads as formatted,
// and the markers come back exactly where you're editing them. A list marker is the exception: it's
// drawn as a bullet or a number in a gutter, always, with the item's wrapped lines hanging under its
// text — see ListMarker below.
//
// Typography comes from the host's class (.prose-field or .edit-area), so the field takes whatever
// size and leading its surface gives it; the formatting classes (md-*) live in index.css.

// Marks a dispatch that brings the editor in line with a new `value` from outside, so it isn't
// reported back up as an edit.
const External = Annotation.define();

// A list row (`singleLine`): Enter does nothing, and a newline that arrives any other way — a paste,
// a drop, a value from outside — becomes a space, because every consumer reads an item as one line.
const singleLineExtensions = [
  Prec.high(keymap.of([{ key: "Enter", run: () => true, shift: () => true }])),
  EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const text = tr.newDoc.toString();
    if (!text.includes("\n")) return tr;
    const changes = [];
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) changes.push({ from: i, to: i + 1, insert: " " });
    return [tr, { changes, sequential: true }];
  }),
];

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";

// The markdown grammar straight from @lezer/markdown, with GitHub's extensions (strikethrough,
// tables, task lists). @codemirror/lang-markdown's markdown() was the obvious choice and it tripled
// the bundle: it brings HTML, CSS and JavaScript modes along for code embedded in markdown, which
// nothing here highlights. The one thing it had that this doesn't is list continuation on Enter.
const markdownSupport = new LanguageSupport(
  new Language(defineLanguageFacet(), markdownParser.configure(GFM), [], "markdown"),
);

const markdownStyle = HighlightStyle.define([
  { tag: t.heading1, class: "md-h md-h1" },
  { tag: t.heading2, class: "md-h md-h2" },
  { tag: t.heading3, class: "md-h md-h3" },
  { tag: [t.heading4, t.heading5, t.heading6], class: "md-h" },
  { tag: t.strong, class: "md-strong" },
  { tag: t.emphasis, class: "md-em" },
  { tag: t.strikethrough, class: "md-strike" },
  { tag: t.monospace, class: "md-code" },
  { tag: t.link, class: "md-link" },
  { tag: t.url, class: "md-url" },
  { tag: [t.processingInstruction, t.contentSeparator], class: "md-mark" },
]);

// Structure only — the field's own class sets the type. CodeMirror's base theme would otherwise
// bring a monospace font, its own line height and padding, and a focus outline.
//
// A list item hangs: the line is padded in by one marker gutter per level of nesting, and pulled
// back out by one with a negative text-indent, so the marker sits in the gutter and every wrapped
// line lines up under the item's first word rather than under its bullet. --md-mark-w is the
// gutter; on paper it's the gutter the structured lists use (index.css), so a markdown list and a
// checklist on the same sheet start their text on the same column.
const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", minHeight: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", minHeight: "inherit" },
  ".cm-content": { padding: "0", caretColor: "var(--ink)", minHeight: "calc(var(--md-min-lines, 1) * 1lh)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ink)" },
  ".cm-placeholder": { color: "var(--ink-placeholder)" },
  ".cm-line.md-li": {
    paddingLeft: "calc(var(--md-depth) * var(--md-mark-w))",
    textIndent: "calc(-1 * var(--md-mark-w))",
  },
  ".cm-line.md-li-cont": { paddingLeft: "calc(var(--md-depth) * var(--md-mark-w))" },
  ".cm-line.md-quote-line": { paddingLeft: "var(--md-mark-w)", color: "var(--ink-soft)" },
  ".cm-line.md-h-line": { paddingTop: "0.4em" },
  ".cm-line.md-h1-line, .cm-line.md-h2-line": { paddingTop: "0.75em" },
  ".cm-line.md-h-line:first-child": { paddingTop: "0" },
  ".cm-line.md-hr-line": { textAlign: "center" },
  ".cm-line.md-codeblock": { fontFamily: MONO, fontSize: "0.88em", backgroundColor: "var(--bg-hover)", padding: "0 8px" },
});

// Markers that hide off the active line. ListMark isn't here — it's drawn by ListMarker instead.
const HIDDEN_MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "HeaderMark", "QuoteMark", "LinkMark", "URL", "LinkTitle"]);

// A list item's marker, drawn in the gutter: a dot for a bullet, the number as typed for an ordered
// item. It replaces the marker's text *and* the indentation before it (nesting is the line's
// padding now, not spaces), and it's atomic — the caret steps over it, and Backspace at the start
// of an item's text takes the whole marker, turning the item back into a paragraph the way it does
// in any word processor. The text underneath is untouched: the file still says `- ` or `2. `.
class ListMarker extends WidgetType {
  constructor(label) { super(); this.label = label; }
  eq(other) { return other.label === this.label; }
  toDOM() {
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    if (this.label) {
      el.className = "md-li-mark md-li-mark--num";
      el.textContent = this.label;
    } else {
      el.className = "md-li-mark";
      el.appendChild(document.createElement("span")).className = "md-li-dot";
    }
    return el;
  }
  ignoreEvent() { return false; }
}

// A `---` rule, off the active line: three spaced dots, centred — the section break of a printed
// page rather than a hairline, which on a sheet already edged by hairlines reads as a form's divider.
class RuleMarker extends WidgetType {
  eq() { return true; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "md-hr";
    el.setAttribute("aria-hidden", "true");
    el.textContent = "· · ·";
    return el;
  }
}

function buildDecorations(view) {
  const { state } = view;
  const doc = state.doc;
  const active = new Set();
  if (view.hasFocus) {
    for (const r of state.selection.ranges) {
      for (let n = doc.lineAt(r.from).number; n <= doc.lineAt(r.to).number; n++) active.add(n);
    }
  }

  const ranges = [];
  const atomic = [];
  const seen = new Set(); // visible ranges can overlap one node; add each decoration once
  const add = (key, range) => { if (!seen.has(key)) { seen.add(key); ranges.push(range); } };
  const lineDeco = (line, cls, attributes) => {
    add(`L${line.from}:${cls}`, Decoration.line(attributes ? { class: cls, attributes } : { class: cls }).range(line.from));
  };
  const lineClass = (node, cls) => {
    for (let pos = node.from; pos <= node.to;) {
      const line = doc.lineAt(pos);
      lineDeco(line, cls);
      pos = line.to + 1;
    }
  };

  // One list item: the marker into the gutter, and any further lines of its own text (a paragraph
  // that was hard-wrapped, or continued after a blank line) hung on the same column. A nested list
  // inside it is left to its own ListItem.
  const listItem = (node) => {
    const mark = node.getChild("ListMark");
    if (!mark) return;
    const first = doc.lineAt(node.from);
    // Only once there's a space after it: a lone `-` is on its way to being a `---` as often as a
    // bullet, and turning it into a dot mid-keystroke would be a guess.
    const gap = doc.sliceString(mark.to, mark.to + 1);
    if (gap !== " " && gap !== "\t") return;
    let depth = 0;
    for (let p = node.parent; p; p = p.parent) if (p.name === "BulletList" || p.name === "OrderedList") depth++;
    const style = `--md-depth:${depth}`;
    lineDeco(first, "md-li", { style });
    const label = node.parent?.name === "OrderedList" ? doc.sliceString(mark.from, mark.to) : null;
    const marker = Decoration.replace({ widget: new ListMarker(label) }).range(first.from, mark.to + 1);
    add(`M${first.from}`, marker);
    atomic.push(marker);
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "BulletList" || child.name === "OrderedList" || child.name === "ListMark") continue;
      for (let pos = child.from; pos <= child.to;) {
        const line = doc.lineAt(pos);
        if (line.number !== first.number) {
          lineDeco(line, "md-li-cont", { style });
          const indent = /^\s*/.exec(line.text)[0].length;
          if (indent) add(`I${line.from}`, Decoration.replace({}).range(line.from, line.from + indent));
        }
        pos = line.to + 1;
      }
    }
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        if (node.name === "FencedCode" || node.name === "CodeBlock") { lineClass(node, "md-codeblock"); return false; }
        if (node.name === "Blockquote") lineClass(node, "md-quote-line");
        if (node.name === "ListItem") listItem(node.node);
        // Space above a heading and not below it, so it belongs to the section it opens.
        if (node.name.startsWith("ATXHeading")) lineClass(node, `md-h-line md-h${node.name.slice(-1)}-line`);
        if (node.name === "HorizontalRule") {
          const line = doc.lineAt(node.from);
          if (!active.has(line.number)) {
            lineDeco(line, "md-hr-line");
            add(`H${node.from}`, Decoration.replace({ widget: new RuleMarker() }).range(node.from, node.to));
          }
          return false;
        }
        if (!HIDDEN_MARKS.has(node.name)) return;
        const parent = node.node.parent?.name || "";
        // Only the marks that wrap inline formatting: not a setext heading's underline, not an
        // autolink's <url>, not a fenced block's ``` (handled above).
        if (node.name === "HeaderMark" && !parent.startsWith("ATXHeading")) return;
        if ((node.name === "URL" || node.name === "LinkMark" || node.name === "LinkTitle") && parent !== "Link") return;
        if (node.name === "CodeMark" && parent !== "InlineCode") return;
        if (active.has(doc.lineAt(node.from).number)) return;
        // A heading's `# ` and a quote's `> ` take their space with them, so the text sits where
        // it would if the marker had never been typed.
        const spaced = node.name === "HeaderMark" || node.name === "QuoteMark";
        const end = spaced && doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
        if (end > node.from) add(`R${node.from}`, Decoration.replace({}).range(node.from, end));
      },
    });
  }
  return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
}

const livePreview = ViewPlugin.fromClass(class {
  constructor(view) { ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(view)); }
  update(u) {
    if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged
        || syntaxTree(u.startState) !== syntaxTree(u.state)) {
      ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(u.view));
    }
  }
}, {
  decorations: (v) => v.decorations,
  provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
});

// Enter inside a list starts the next item — the same bullet, or the next number, and a fresh `[ ]`
// after a task — and Enter on an item that's still empty ends the list instead, leaving a plain
// line. Inside a quote it carries the `> ` on. This is the one thing @codemirror/lang-markdown had
// that the bare grammar above doesn't (see markdownSupport); anywhere else, and inside code, Enter
// falls through to the default.
const LIST_LINE = /^(\s*)(?:([-*+])|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/;
const QUOTE_LINE = /^\s*(?:>[ \t]?)+/;

function continueMarkup(view) {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length !== 1 || !range.empty) return false;
  const tree = syntaxTree(state);
  for (let n = tree.resolveInner(range.head, -1); n; n = n.parent) {
    if (n.name === "FencedCode" || n.name === "CodeBlock") return false;
  }
  const line = state.doc.lineAt(range.head);
  const list = LIST_LINE.exec(line.text);
  // The regex alone would take `* * *` (a rule) for an item; the parser knows which it is.
  const isList = list && tree.resolveInner(line.from + list[1].length, 1).name === "ListMark";
  const quote = !isList && QUOTE_LINE.exec(line.text);
  const prefix = isList ? list[0] : quote && tree.resolveInner(line.from + quote[0].indexOf(">"), 1).name === "QuoteMark" ? quote[0] : null;
  if (prefix === null || range.head < line.from + prefix.length) return false;

  // An empty item ends the list. The marker goes and the caret moves one line further down, leaving
  // a blank line behind it: a line written straight under a list item is, to every other markdown
  // reader, more of that item, so a list only really ends at a blank line.
  if (!line.text.slice(prefix.length).trim()) {
    view.dispatch({ changes: { from: line.from, to: line.to, insert: "\n" }, selection: { anchor: line.from + 1 }, userEvent: "delete" });
    return true;
  }
  const number = list?.[3] ? Number(list[3]) + 1 : null;
  const next = !isList ? prefix
    : `${list[1]}${number !== null ? number + list[4] : list[2]}${list[5]}${list[6] ? "[ ] " : ""}`;
  const insert = `\n${next}`;
  view.dispatch({
    changes: [{ from: range.head, insert }, ...(number !== null ? renumberAfter(state, line, number + 1) : [])],
    selection: { anchor: range.head + insert.length },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

// The items after `line` in its numbered list, renumbered from `from` on — so a new item slipped
// into the middle of `1. 2. 3.` pushes the old 3 on to 4 rather than leaving two 3s. Items that
// already count up from there are left alone, and the walk stops at the end of the list.
function renumberAfter(state, line, from) {
  const tree = syntaxTree(state);
  let item = tree.resolveInner(line.from + /^\s*/.exec(line.text)[0].length, 1);
  while (item && item.name !== "ListItem") item = item.parent;
  const changes = [];
  let expected = from;
  for (let sib = item?.nextSibling; sib; sib = sib.nextSibling) {
    if (sib.name !== "ListItem") continue;
    const mark = sib.getChild("ListMark");
    if (!mark) break;
    const text = state.sliceDoc(mark.from, mark.to);
    const digits = /^\d+/.exec(text)?.[0];
    if (!digits) break;
    if (Number(digits) !== expected) changes.push({ from: mark.from, to: mark.from + digits.length, insert: String(expected) });
    expected++;
  }
  return changes;
}

// Where a list item's text starts, if `line` is an item whose marker is drawn (ListMarker): the end
// of the range the marker widget replaces. Null for any other line.
function textStart(state, line) {
  const indent = /^\s*/.exec(line.text)[0].length;
  const mark = syntaxTree(state).resolveInner(line.from + indent, 1);
  if (mark.name !== "ListMark" || mark.from !== line.from + indent) return null;
  const gap = state.sliceDoc(mark.to, mark.to + 1);
  return gap === " " || gap === "\t" ? mark.to + 1 : null;
}

// The caret never stops in front of a drawn list marker. Position 0 of an item's line is a real
// place in the text, but on screen it's the left edge of the gutter, and from there Backspace joins
// the item onto the line above instead of taking its marker off. Anything that would land the caret
// there — Home, a click on the bullet, arrowing up or down at column 0 — lands it at the start of
// the item's text instead, and ArrowLeft from there (which the atomic marker would otherwise stop
// at the gutter's edge) goes on to the end of the line above.
const caretOutOfGutter = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.selection.ranges.length !== 1 || !tr.selection.main.empty) return tr;
  const { state } = tr;
  const head = tr.selection.main.head;
  const line = state.doc.lineAt(head);
  if (head !== line.from) return tr;
  const start = textStart(state, line);
  if (start === null) return tr;
  const before = tr.startState.selection.main;
  const leftward = !tr.docChanged && before.empty && before.head === start && line.number > 1;
  return [tr, { selection: { anchor: leftward ? line.from - 1 : start }, sequential: true }];
});

// ⌘B / ⌘I (Ctrl on Windows): wrap the selection in ** or _, or unwrap it if it's already wrapped.
// With nothing selected, the pair goes in with the caret between them, ready to type into. A
// selection that starts in a list item's gutter starts at its text: `**1. item**` isn't an item.
const toggleWrap = (mark) => (view) => {
  const { state } = view;
  const len = mark.length;
  view.dispatch(state.update(state.changeByRange((selected) => {
    const line = state.doc.lineAt(selected.from);
    const start = textStart(state, line);
    const range = start !== null && selected.from < start ? EditorSelection.range(start, Math.max(start, selected.to)) : selected;
    const wrapped = state.sliceDoc(range.from - len, range.from) === mark && state.sliceDoc(range.to, range.to + len) === mark;
    return wrapped
      ? { changes: [{ from: range.from - len, to: range.from }, { from: range.to, to: range.to + len }], range: EditorSelection.range(range.from - len, range.to - len) }
      : { changes: [{ from: range.from, insert: mark }, { from: range.to, insert: mark }], range: EditorSelection.range(range.from + len, range.to + len) };
  }), { scrollIntoView: true, userEvent: "input" }));
  return true;
};

const writingKeymap = [
  { key: "Enter", run: continueMarkup },
  { key: "Mod-b", run: toggleWrap("**") },
  { key: "Mod-i", run: toggleWrap("_") },
];

// Typing never runs the caret into the bottom of the window: the page scrolls to keep a few lines
// of paper under it, the way it does in a word processor.
const scrollRoom = EditorView.scrollMargins.of(() => ({ top: 48, bottom: 120 }));

// `value`/`onChange` is the same contract as a textarea's string: onChange gets the whole new text.
// `minLines` is the empty field's height in lines. `singleLine` makes it a list row (see above).
// `autoFocus` puts the caret at the end on mount. `ref` exposes focus() / focusEnd() — the same
// thing, caret at the end — for a row that was just added, or a click on blank paper below the text
// (MarkdownEditor's `fill`).
export default function LiveMarkdown({
  value, onChange, placeholder = "", ariaLabel, className = "", minLines = 1, singleLine = false, autoFocus = false, style, ref,
}) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // A layout effect, so the editor exists before `ref` is attached: a parent that focuses a row from
  // its ref callback the moment the row mounts (ChecklistEditor) would otherwise focus nothing.
  useLayoutEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value || "",
        extensions: [
          history(),
          keymap.of([...writingKeymap, ...defaultKeymap, ...historyKeymap]),
          scrollRoom,
          caretOutOfGutter,
          markdownSupport,
          syntaxHighlighting(markdownStyle),
          livePreview,
          EditorView.lineWrapping,
          placeholderText(placeholder),
          editorTheme,
          singleLine ? singleLineExtensions : [],
          ariaLabel ? EditorView.contentAttributes.of({ "aria-label": ariaLabel }) : [],
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(External))) {
              onChangeRef.current(u.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (autoFocus) {
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    }
    return () => { view.destroy(); viewRef.current = null; };
    // Created once; later `value` changes arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value that didn't come from typing here (a reload from disk, an undo elsewhere) replaces the
  // text. Typing round-trips through the parent and arrives equal, so it's a no-op.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    const next = value || "";
    if (next !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: next }, annotations: External.of(true) });
    }
  }, [value]);

  useImperativeHandle(ref, () => {
    const focusEnd = () => {
      const view = viewRef.current;
      if (!view) return;
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
    };
    return { focus: focusEnd, focusEnd };
  }, []);

  return <div ref={hostRef} className={`live-md ${className}`.trim()} style={{ "--md-min-lines": minLines, ...style }} />;
}
