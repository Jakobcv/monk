import { useState } from "react";
import { Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { BORDER, SPACE, INK, INK_SOFT, INK_FAINT, SIZE, ACCENT } from "./lib/theme";
import { Eyebrow, Meta, PageHeading } from "./ui/text";
import { useCopy } from "./lib/useCopy";
import MarkdownEditor from "./MarkdownEditor";
import Button from "./ui/Button";
import Card from "./ui/Card";
import SwapIcon from "./ui/SwapIcon";
import Page from "./ui/Page";

// A workspace document's page (see lib/workspaceDocs.js) — DESIGN.md today. Two states, because the
// file is optional and the app never writes one on its own: with no file, an explanation and a
// button that creates the skeleton; with one, the raw markdown, exactly as it is on disk.
export default function WorkspaceDocPage({ doc, text, onCreate, onChange, onRemove }) {
  return typeof text === "string"
    ? <Editor doc={doc} text={text} onChange={onChange} onRemove={onRemove} />
    : <NotCreated doc={doc} onCreate={onCreate} />;
}

function FormatLink({ doc }) {
  return (
    <a href={doc.formatUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs, color: INK_SOFT, fontSize: SIZE.sm }}>
      About the {doc.file} format <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function NotCreated({ doc, onCreate }) {
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { await onCreate(); } finally { setBusy(false); }
  };
  return (
    <Page>
      <div style={{ maxWidth: "560px", margin: "40px auto 0" }}>
        <Meta translate="no">{doc.file}</Meta>
        <PageHeading style={{ margin: `${SPACE.xs} 0 ${SPACE.md}` }}>{doc.label}</PageHeading>
        <p style={{ color: INK, fontSize: SIZE.body, lineHeight: 1.55, margin: `0 0 ${SPACE.base}` }}>{doc.summary}</p>
        <p style={{ color: INK_SOFT, fontSize: SIZE.body, lineHeight: 1.55, margin: `0 0 ${SPACE.lg}` }}>
          This workspace doesn't have one yet. Creating it writes a skeleton in the right format: every
          section, with guidance in comments and no values chosen. Nothing from it reaches a build
          brief until you write something in it.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
          <Button variant="primary" size="md" onClick={create} disabled={busy}>
            {busy ? "Creating…" : `Create ${doc.file}`}
          </Button>
          <FormatLink doc={doc} />
        </div>
      </div>
    </Page>
  );
}

// `text` only seeds local state on mount — the parent remounts this (via its `key`) when the file
// changes on disk, same as every other detail page, which is what lets the "changed on disk while
// you were editing" notice hold your text rather than replacing it under the cursor.
function Editor({ doc, text, onChange, onRemove }) {
  const [value, setValue] = useState(text);
  const [copied, copy] = useCopy();
  const change = (next) => { setValue(next); onChange(next); };

  return (
    <Page style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
      <div style={{ display: "flex", gap: "40px", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: "100%", maxWidth: "760px", flex: "1 1 480px", minWidth: 0 }}>
          {/* Wraps rather than squeezing: on a narrow pane the buttons drop below the title instead
              of sitting on top of it. */}
          <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: SPACE.base, marginBottom: SPACE.md }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <Meta translate="no">{doc.file}</Meta>
              <PageHeading style={{ margin: `${SPACE.xs} 0 0` }}>{doc.label}</PageHeading>
            </div>
            <button
              className="btn btn--sm btn--subtle"
              onClick={() => copy(value)}
              title={`Copy ${doc.file} to the clipboard`}
              style={{ flexShrink: 0, color: copied ? ACCENT.action : INK_SOFT }}
            >
              <SwapIcon active={copied} activeIcon={Check} inactiveIcon={Copy} size={16} />
              {copied ? "Copied" : "Copy .md"}
            </button>
            <button
              className="btn btn--sm btn--subtle"
              onClick={onRemove}
              title={`Delete ${doc.file} from this workspace`}
              style={{ flexShrink: 0, color: INK_SOFT }}
            >
              <Trash2 size={16} /> Remove
            </button>
          </div>
          <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: "18px" }} />
          <MarkdownEditor value={value} onChange={change} hint={false} placeholder={`Write ${doc.file} in Markdown…`} />
        </div>

        <aside style={{ width: "232px", flexShrink: 0, position: "sticky", top: "4px" }}>
          <Card padded>
            <Eyebrow>Sections, in order</Eyebrow>
            <ol style={{ margin: `${SPACE.md} 0 0`, paddingLeft: "18px", color: INK, fontSize: SIZE.sm, lineHeight: 1.7 }}>
              {doc.outline.map((title) => <li key={title}>{title}</li>)}
            </ol>
            <p style={{ margin: `${SPACE.md} 0`, color: INK_FAINT, fontSize: SIZE.xs, lineHeight: 1.5 }}>
              Any section can be left out. Build briefs skip comments and sections with nothing
              written in them.
            </p>
            <FormatLink doc={doc} />
          </Card>
        </aside>
      </div>
    </Page>
  );
}
