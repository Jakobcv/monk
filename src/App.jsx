import { useState, useRef, useEffect, useMemo } from "react";
import { loadWorkspace, saveWorkspace } from "./lib/storage";
import { blankBoard, demoBoard, bumpNextId } from "./lib/boardModel";
import { font, INK, INK_SOFT, BORDER, SAVE_STATUS_COLOR, SAVE_STATUS_LABEL } from "./lib/theme";
import StartPage from "./StartPage";
import Board from "./Board";

const HASH_PREFIX = "#/board/";
const goToStart = () => { window.location.hash = ""; };
const goToBoard = (id) => { window.location.hash = HASH_PREFIX + encodeURIComponent(id); };

function useActiveBoardId() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash.startsWith(HASH_PREFIX) ? decodeURIComponent(hash.slice(HASH_PREFIX.length)) : null;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [boards, setBoards] = useState([]);
  const loadedRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const activeBoardId = useActiveBoardId();

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
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        {activeBoard ? (
          <button
            onClick={goToStart}
            style={{
              fontFamily: font, fontWeight: 600, fontSize: "13px", color: INK_SOFT,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            ← Boards
          </button>
        ) : (
          <span style={{ fontFamily: font, fontWeight: 600, fontSize: "14px", color: INK }}>Evidence Loop</span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: SAVE_STATUS_COLOR[saveStatus] }} />
          <span style={{ fontFamily: font, fontSize: "11px", color: INK_SOFT }}>{SAVE_STATUS_LABEL[saveStatus]}</span>
          {saveStatus === "error" && (
            <button
              onClick={retrySave}
              style={{ fontFamily: font, fontSize: "11px", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: activeBoard ? "12px" : 0, boxSizing: "border-box" }}>
        {activeBoardId && !activeBoard ? (
          <div style={{ fontFamily: font, textAlign: "center", color: INK_SOFT, fontSize: "13.5px", padding: "60px 0" }}>
            Board not found.{" "}
            <button onClick={goToStart} style={{ fontFamily: font, color: INK, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Back to boards
            </button>
          </div>
        ) : activeBoard ? (
          <Board key={activeBoard.id} board={activeBoard} onChange={(patch) => updateBoard(activeBoard.id, patch)} />
        ) : (
          <StartPage boards={boards} onCreate={createBoard} onOpen={goToBoard} onRename={renameBoard} onDelete={deleteBoard} />
        )}
      </div>
    </div>
  );
}
