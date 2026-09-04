import { useState, useRef, useEffect, useMemo } from "react";
import { loadWorkspace, saveWorkspace } from "./lib/storage";
import { blankBoard, boardFromImport, bumpNextId, genId, KIND_ARRAY_KEY } from "./lib/boardModel";
import { fsAccessSupported, getStoredHandle, pickFolder, tryReuseHandle, reconnectHandle } from "./lib/fsPersistence";
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

function ConnectScreen({ title, message, buttonLabel, onClick }) {
  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "380px", textAlign: "center" }}>
        <div style={{ fontFamily: font, fontWeight: 600, fontSize: "16px", color: INK, marginBottom: "8px" }}>{title}</div>
        <div style={{ fontFamily: font, fontSize: "13.5px", color: INK_SOFT, lineHeight: 1.5, marginBottom: buttonLabel ? "18px" : 0 }}>
          {message}
        </div>
        {buttonLabel && (
          <button
            onClick={onClick}
            style={{
              fontFamily: font, fontWeight: 600, fontSize: "13px", color: "#fff",
              background: INK, border: "none", borderRadius: "7px", padding: "9px 18px", cursor: "pointer",
            }}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // phase: checking -> (needsConnect | needsReconnect | unsupported) -> loading -> ready
  const [phase, setPhase] = useState("checking");
  const [dirHandle, setDirHandle] = useState(null);
  const [pendingHandle, setPendingHandle] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [boards, setBoards] = useState([]);
  const skipNextSaveRef = useRef(true);
  const route = useRoute();
  const activeBoardId = route.boardId;

  // on mount: reuse a previously-granted folder silently if permission is still live,
  // otherwise ask for a click — showDirectoryPicker/requestPermission both require one
  useEffect(() => {
    if (!fsAccessSupported) { setPhase("unsupported"); return; }
    (async () => {
      const stored = await getStoredHandle();
      if (!stored) { setPhase("needsConnect"); return; }
      if (await tryReuseHandle(stored)) {
        setDirHandle(stored);
        setPhase("loading");
      } else {
        setPendingHandle(stored);
        setPhase("needsReconnect");
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "loading" || !dirHandle) return;
    let cancelled = false;
    loadWorkspace(dirHandle)
      .then((record) => {
        if (cancelled) return;
        bumpNextId(record.boards);
        setBoards(record.boards);
      })
      .catch((err) => {
        console.error("Failed to load the research folder:", err);
      })
      .finally(() => {
        if (cancelled) return;
        setPhase("ready");
      });
    return () => { cancelled = true; };
  }, [phase, dirHandle]);

  const workspace = useMemo(() => ({ boards }), [boards]);

  // debounced autosave: skip the one save that would otherwise immediately re-write the
  // data we just loaded from disk
  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveWorkspace(dirHandle, workspace).then(
        () => setSaveStatus("saved"),
        () => setSaveStatus("error")
      );
    }, 700);
    return () => clearTimeout(t);
  }, [phase, dirHandle, workspace]);

  const retrySave = () => {
    setSaveStatus("saving");
    saveWorkspace(dirHandle, workspace).then(
      () => setSaveStatus("saved"),
      () => setSaveStatus("error")
    );
  };

  const handleConnect = async () => {
    try {
      const handle = await pickFolder();
      setDirHandle(handle);
      setPhase("loading");
    } catch {
      // user cancelled the picker — stay on the connect screen
    }
  };
  const handleReconnect = async () => {
    if (await reconnectHandle(pendingHandle)) {
      setDirHandle(pendingHandle);
      setPhase("loading");
    }
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

  if (phase === "unsupported") {
    return (
      <ConnectScreen
        title="Browser not supported"
        message="Evidence Loop stores your research as files in a folder you pick, which needs the File System Access API — available in Chrome, Edge, and other Chromium-based browsers, but not Firefox or Safari."
      />
    );
  }
  if (phase === "checking") {
    return <ConnectScreen title="Evidence Loop" message="Checking for a connected folder…" />;
  }
  if (phase === "needsConnect") {
    return (
      <ConnectScreen
        title="Connect your research folder"
        message="Pick a folder — ideally one inside your project's repo — where every board is saved as plain markdown files you can read, grep, and commit like any other file."
        buttonLabel="Connect folder"
        onClick={handleConnect}
      />
    );
  }
  if (phase === "needsReconnect") {
    return (
      <ConnectScreen
        title="Reconnect your research folder"
        message="Permission to read and write your research folder needs to be re-granted after a browser restart."
        buttonLabel="Reconnect folder"
        onClick={handleReconnect}
      />
    );
  }
  if (phase === "loading") {
    return <ConnectScreen title="Evidence Loop" message="Loading your research folder…" />;
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
