import { useState, useRef, useEffect, useMemo } from "react";
import { loadWorkspace, saveWorkspace } from "./lib/storage";
import { blankBoard, demoBoard, boardFromImport, bumpNextId, genId, KIND_ARRAY_KEY } from "./lib/boardModel";
import { font, INK, INK_SOFT } from "./lib/theme";
import Header from "./Header";
import HomePage from "./HomePage";
import Board from "./Board";

const HASH_PREFIX = "#/board/";
const goToStart = () => { window.location.hash = ""; };
const goToBoard = (id, cardId) => {
  window.location.hash = HASH_PREFIX + encodeURIComponent(id) + (cardId != null ? "/" + encodeURIComponent(cardId) : "");
};

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  if (hash.startsWith(HASH_PREFIX)) {
    const [boardIdRaw, cardIdRaw] = hash.slice(HASH_PREFIX.length).split("/");
    return {
      name: "board",
      boardId: decodeURIComponent(boardIdRaw),
      cardId: cardIdRaw ? Number(decodeURIComponent(cardIdRaw)) : null,
    };
  }
  return { name: "start", boardId: null, cardId: null };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [boards, setBoards] = useState([]);
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const route = useRoute();
  const activeBoardId = route.boardId;

  // load once on mount: server data wins, a single demo board is only the fallback
  // for a brand-new/empty workspace, not a permanent default
  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((record) => {
        if (cancelled) return;
        const loaded = record && Array.isArray(record.boards) && record.boards.length ? record.boards : [demoBoard()];
        bumpNextId(loaded);
        setBoards(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        const loaded = [demoBoard()];
        bumpNextId(loaded);
        setBoards(loaded);
      })
      .finally(() => {
        if (cancelled) return;
        loadedRef.current = true;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const workspace = useMemo(() => ({ boards }), [boards]);

  // debounced autosave: skip while the initial load hasn't landed, and skip the one
  // save that would otherwise immediately re-PUT the data we just fetched
  useEffect(() => {
    if (!loadedRef.current) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveWorkspace(workspace).then(
        () => setSaveStatus("saved"),
        () => setSaveStatus("error")
      );
    }, 700);
    return () => clearTimeout(t);
  }, [workspace]);

  const retrySave = () => {
    setSaveStatus("saving");
    saveWorkspace(workspace).then(
      () => setSaveStatus("saved"),
      () => setSaveStatus("error")
    );
  };

  const updateBoard = (id, patch) =>
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b)));
  const renameBoard = (id, name) => updateBoard(id, { name });
  const deleteBoard = (id) => {
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (activeBoardId === id) goToStart();
  };
  const createBoard = () => {
    const board = blankBoard();
    setBoards((prev) => [board, ...prev]);
    goToBoard(board.id);
  };
  const importBoard = async (file) => {
    let board;
    try {
      board = boardFromImport(JSON.parse(await file.text()));
    } catch {
      window.alert("Couldn't import that file — make sure it's a JSON file exported from Evidence Loop.");
      return;
    }
    setBoards((prev) => {
      const next = [board, ...prev];
      bumpNextId(next);
      return next;
    });
    goToBoard(board.id);
  };

  // attach a card found in search onto another board as a live reference — never a copy,
  // so edits to the source (or the source disappearing) show up wherever it's cited
  const attachReference = (kind, sourceBoardId, sourceItemId, destBoardId) => {
    const arrayKey = KIND_ARRAY_KEY[kind];
    const card = { id: genId(), ref: { boardId: sourceBoardId, itemId: sourceItemId } };
    if (destBoardId === "__new__") {
      const board = { ...blankBoard(), [arrayKey]: [card] };
      setBoards((prev) => [board, ...prev]);
      goToBoard(board.id, card.id);
    } else {
      setBoards((prev) => prev.map((b) => (b.id === destBoardId ? { ...b, [arrayKey]: [...b[arrayKey], card], updatedAt: Date.now() } : b)));
      goToBoard(destBoardId, card.id);
    }
  };

  const activeBoard = activeBoardId ? boards.find((b) => b.id === activeBoardId) : null;

  if (loading) {
    return (
      <div style={{ fontFamily: font, height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: INK_SOFT, fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column" }}>
      <Header onGoHome={goToStart} saveStatus={saveStatus} onRetrySave={retrySave} />

      <div style={{ flex: 1, minHeight: 0, padding: activeBoard ? "12px" : 0, boxSizing: "border-box" }}>
        {activeBoardId && !activeBoard ? (
          <div style={{ fontFamily: font, textAlign: "center", color: INK_SOFT, fontSize: "13.5px", padding: "60px 0" }}>
            Board not found.{" "}
            <button onClick={goToStart} style={{ fontFamily: font, color: INK, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Back to boards
            </button>
          </div>
        ) : activeBoard ? (
          <Board
            key={activeBoard.id}
            board={activeBoard}
            onChange={(patch) => updateBoard(activeBoard.id, patch)}
            highlightCardId={route.cardId}
            allBoards={boards}
            onOpenBoard={goToBoard}
          />
        ) : (
          <HomePage boards={boards} onCreate={createBoard} onImport={importBoard} onOpen={goToBoard} onRename={renameBoard} onDelete={deleteBoard} onAttach={attachReference} />
        )}
      </div>
    </div>
  );
}
