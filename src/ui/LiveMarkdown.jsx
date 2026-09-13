import { useEffect, useImperativeHandle, useRef } from "react";
import { Annotation, EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap, placeholder as placeholderText } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, Language, LanguageSupport, defineLanguageFacet, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { GFM, parser as markdownParser } from "@lezer/markdown";
import { tags as t } from "@lezer/highlight";

// Markdown that formats as you type: **bold** turns bold, a `# ` line grows, `code` becomes a chip.
// The value is still the raw markdown string, character for character — nothing is converted, so
// what's on disk is exactly what was typed and every consumer (the brief, an agent) reads the same.
//
// This is CodeMirror 6 with markdown decorations, not a WYSIWYG document model. The app had one of
// those (Milkdown Crepe) and dropped it: 205 packages, a 1.77 MB bundle, and a document model that
// owned the string. CodeMirror is a fraction of that and edits the text itself.
//
// The syntax markers (**, _, `, # , the (url) of a link) are hidden except on the line the cursor
// is on, and everywhere while the field isn't focused — so text reads as formatted, and the markers
// come back exactly where you're editing them. List markers and quote markers always stay visible.
//
// Typography comes from the host's class (.prose-field or .edit-area), so the field takes whatever
// size and leading its surface gives it; the formatting classes (md-*) live in index.css.

// Marks a dispatch that brings the editor in line with a new `value` from outside, so it isn't
// reported back up as an edit.
const External = Annotation.define();

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
const editorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", minHeight: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", minHeight: "inherit" },
  ".cm-content": { padding: "0", caretColor: "var(--ink)", minHeight: "calc(var(--md-min-lines, 1) * 1lh)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ink)" },
  ".cm-placeholder": { color: "var(--ink-placeholder)" },
  ".cm-line.md-quote-line": { paddingLeft: "12px", boxShadow: "inset 2px 0 0 var(--border-strong)", color: "var(--ink-soft)" },
  ".cm-line.md-codeblock": { fontFamily: MONO, fontSize: "0.88em", backgroundColor: "var(--bg-hover)", padding: "0 8px" },
});

// Markers that hide off the active line. ListMark and QuoteMark aren't here: a list or a quote
// without its marker reads as a different thing, not as the same thing formatted.
const HIDDEN_MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "HeaderMark", "LinkMark", "URL", "LinkTitle"]);

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
  const seen = new Set(); // visible ranges can overlap one node; add each decoration once
  const add = (key, range) => { if (!seen.has(key)) { seen.add(key); ranges.push(range); } };
  const lineClass = (node, cls) => {
    for (let pos = node.from; pos <= node.to;) {
      const line = doc.lineAt(pos);
      add(`L${line.from}`, Decoration.line({ class: cls }).range(line.from));
      pos = line.to + 1;
    }
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        if (node.name === "FencedCode" || node.name === "CodeBlock") { lineClass(node, "md-codeblock"); return false; }
        if (node.name === "Blockquote") lineClass(node, "md-quote-line");
        if (!HIDDEN_MARKS.has(node.name)) return;
        const parent = node.node.parent?.name || "";
        // Only the marks that wrap inline formatting: not a setext heading's underline, not an
        // autolink's <url>, not a fenced block's ``` (handled above).
        if (node.name === "HeaderMark" && !parent.startsWith("ATXHeading")) return;
        if ((node.name === "URL" || node.name === "LinkMark" || node.name === "LinkTitle") && parent !== "Link") return;
        if (node.name === "CodeMark" && parent !== "InlineCode") return;
        if (active.has(doc.lineAt(node.from).number)) return;
        // A heading's `# ` takes its space with it, so the text sits at the margin.
        const end = node.name === "HeaderMark" && doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
        if (end > node.from) add(`R${node.from}`, Decoration.replace({}).range(node.from, end));
      },
    });
  }
  return Decoration.set(ranges, true);
}

const livePreview = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDecorations(view); }
  update(u) {
    if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged
        || syntaxTree(u.startState) !== syntaxTree(u.state)) {
      this.decorations = buildDecorations(u.view);
    }
  }
}, { decorations: (v) => v.decorations });

// `value`/`onChange` is the same contract as a textarea's string: onChange gets the whole new text.
// `minLines` is the empty field's height in lines. `ref` exposes focusEnd(), for a click on blank
// paper below the text (MarkdownEditor's `fill`).
export default function LiveMarkdown({ value, onChange, placeholder = "", ariaLabel, className = "", minLines = 1, style, ref }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value || "",
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdownSupport,
          syntaxHighlighting(markdownStyle),
          livePreview,
          EditorView.lineWrapping,
          placeholderText(placeholder),
          editorTheme,
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

  useImperativeHandle(ref, () => ({
    focusEnd() {
      const view = viewRef.current;
      if (!view) return;
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
    },
  }), []);

  return <div ref={hostRef} className={`live-md ${className}`.trim()} style={{ "--md-min-lines": minLines, ...style }} />;
}
