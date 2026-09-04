import { genId } from "./boardModel.js";
import { boardMetaToMarkdown, markdownToBoardMeta, cardToMarkdown, markdownToCard } from "./markdown.js";

const CARD_KINDS = ["signals", "insights", "actions", "results"];
const singular = (kind) => kind.slice(0, -1);

async function writeFile(dirHandle, name, content) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

// Workspace persistence: every board is a folder (named by board.id, so renaming a board
// never touches the folder path), one markdown file per card, grouped by kind. Loading and
// saving both walk the whole tree — no per-card dirty-tracking yet, so every save rewrites
// everything. Fine at personal scale; the folder is plain files a human or an LLM can read
// directly, which was the whole point of moving off localStorage.
export async function loadWorkspace(dirHandle) {
  const boards = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "directory") continue;
    try {
      const boardMdFile = await handle.getFileHandle("board.md");
      const meta = markdownToBoardMeta(await (await boardMdFile.getFile()).text());
      const board = { ...meta, signals: [], insights: [], actions: [], results: [], connections: [] };

      for (const kind of CARD_KINDS) {
        let subDir;
        try {
          subDir = await handle.getDirectoryHandle(kind);
        } catch {
          continue; // no cards of this kind yet
        }
        for await (const [fname, fhandle] of subDir.entries()) {
          if (fhandle.kind !== "file" || !fname.endsWith(".md")) continue;
          const text = await (await fhandle.getFile()).text();
          const { card, connectsTo } = markdownToCard(text, singular(kind));
          board[kind].push(card);
          for (const to of connectsTo) board.connections.push({ id: genId(), from: card.id, to });
        }
      }
      boards.push(board);
    } catch (err) {
      console.error(`Skipping "${name}" — couldn't read it as a board folder:`, err);
    }
  }
  return { boards };
}

export async function saveWorkspace(dirHandle, workspace) {
  const currentBoardIds = new Set(workspace.boards.map((b) => b.id));
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "directory" && !currentBoardIds.has(name)) {
      await dirHandle.removeEntry(name, { recursive: true });
    }
  }

  for (const board of workspace.boards) {
    const boardDir = await dirHandle.getDirectoryHandle(board.id, { create: true });
    await writeFile(boardDir, "board.md", boardMetaToMarkdown(board));

    for (const kind of CARD_KINDS) {
      const items = board[kind] || [];
      const subDir = await boardDir.getDirectoryHandle(kind, { create: true });
      const currentNames = new Set(items.map((item) => `${item.id}.md`));
      for await (const [fname, fhandle] of subDir.entries()) {
        if (fhandle.kind === "file" && !currentNames.has(fname)) await subDir.removeEntry(fname);
      }
      for (const item of items) {
        const connectsTo = (board.connections || []).filter((c) => c.from === item.id).map((c) => c.to);
        await writeFile(subDir, `${item.id}.md`, cardToMarkdown({ ...item, connectsTo }, singular(kind)));
      }
    }
  }
}
