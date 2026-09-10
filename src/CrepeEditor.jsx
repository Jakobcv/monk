import { useRef, useEffect } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

// Owns the Crepe editor's mount lifecycle — shared by DocumentPage (with a title above it) and
// SpecPage's Design/Plan tabs (no title, just this). `value` only seeds the editor on mount;
// Crepe is uncontrolled after that like any other rich-text editor, so the parent should treat
// `onChange` as the source of truth rather than feeding edited `value` back in.
export default function CrepeEditor({ value, onChange }) {
  const editorRootRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const crepe = new Crepe({ root: editorRootRef.current, defaultValue: value });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => onChangeRef.current(markdown));
    });
    crepe.create();
    return () => { crepe.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        /* Crepe's theme ships its own page-like background and wide inner padding on the
           editor — override both so it reads as writing directly on our page background
           rather than a boxed-in card. */
        .el-doc-editor .milkdown { background: transparent; }
        .el-doc-editor .milkdown .ProseMirror { padding: 8px 0; min-height: 60vh; }
        /* The block-edit drag/plus handles default to transitioning "all", which animates
           their top/left as they jump between blocks — reads as scooting around. Only
           opacity should animate; position should snap instantly. */
        .el-doc-editor .milkdown .milkdown-block-handle { transition: opacity 0.1s ease-in; }
      `}</style>
      <div ref={editorRootRef} className="el-doc-editor" />
    </>
  );
}
