import { designSystemTemplate } from "./designSystem.js";

// Files at the root of a workspace that exist for agents to read, in a format defined somewhere
// else — which the app offers to create from a skeleton rather than leaving you to find the format
// and copy it in by hand. Each one is optional: absent until someone asks for it, and never written
// with content nobody chose. DESIGN.md is the only one today; the list exists so that a second
// one is an entry here, not a new feature.
//
//   id         stable key in app state, in the route (#/workspace/<id>), and for the watcher
//   file       its name at the workspace root — its identity on disk
//   label      what the sidebar and its page call it
//   summary    one line on what it is for
//   formatUrl  where the format is defined
//   editor     a structured editor for this format, if there is one ("design-system"); without
//              one the page edits the raw markdown
//   template   the skeleton written on create; receives { workspaceName }
export const WORKSPACE_DOCS = [
  {
    id: "design-system",
    file: "DESIGN.md",
    label: "Design system",
    summary: "The visual language for everything built here: design tokens, and the reasoning behind them. A contract for everything built from these specs.",
    formatUrl: "https://github.com/google-labs-code/design.md",
    editor: "design-system",
    template: ({ workspaceName }) => designSystemTemplate(workspaceName),
  },
];

export const workspaceDocById = (id) => WORKSPACE_DOCS.find((d) => d.id === id) || null;
export const workspaceDocByFile = (file) => WORKSPACE_DOCS.find((d) => d.file === file) || null;
