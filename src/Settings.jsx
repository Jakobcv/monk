import { useState } from "react";
import { FolderOpen, Unlink } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { THEME_MODES } from "./lib/themeMode";

const LABELS = { light: "Light", dark: "Dark", system: "System" };

// A set of exclusive options, so it's a radiogroup rather than three buttons: one tab stop, and
// the arrow keys move the selection (WAI-ARIA APG). Choosing applies the theme on the spot — there
// is nothing to validate, and the whole point of the choice is how the app then looks.
function ThemeChoice({ value, onChange }) {
  const move = (step) => {
    const i = THEME_MODES.indexOf(value);
    onChange(THEME_MODES[(i + step + THEME_MODES.length) % THEME_MODES.length]);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };
  return (
    <div className="seg" role="radiogroup" aria-label="Theme" onKeyDown={onKeyDown}>
      {THEME_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          tabIndex={value === mode ? 0 : -1}
          className="seg__option"
          data-selected={value === mode ? "" : undefined}
          onClick={() => onChange(mode)}
        >
          {LABELS[mode]}
        </button>
      ))}
    </div>
  );
}

// Everything a person can change about Monk, which is three things. Not a preferences frame
// waiting for a fourth: the theme, and the two folder actions that used to sit in the top bar.
export default function Settings({ themeMode, onThemeModeChange, folderLabel, onChangeFolder, onDetachFolder, onClose }) {
  const [confirmingDetach, setConfirmingDetach] = useState(false);

  return (
    <Modal title="Settings" onClose={onClose} width={460}>
      <div className="settings-group">
        <div className="settings-row">
          <label className="settings-label" id="settings-theme-label">Theme</label>
          <ThemeChoice value={themeMode} onChange={onThemeModeChange} />
        </div>
        <p className="settings-hint">
          {themeMode === "system" ? "Following your desktop." : "Set here, whatever your desktop says."}
        </p>
      </div>

      {/* With no folder connected there is nothing to change or detach, so the group isn't there. */}
      {folderLabel && (
        <div className="settings-group settings-group--divided">
          <div className="settings-row">
            <span className="settings-label">Folder</span>
            <span className="settings-folder" title={folderLabel}>{folderLabel}</span>
          </div>

          {confirmingDetach ? (
            // Inline rather than a second dialog: a dialog over a dialog is two focus traps deep
            // for a question with two answers.
            <div className="settings-confirm" role="group" aria-label="Confirm detaching this folder">
              <p className="settings-confirm__text">
                Detach this folder? Monk forgets it and returns to the start screen. Nothing on disk changes.
              </p>
              {/* Cancel takes the focus, not Detach: the confirmation exists to stop a stray
                  keystroke detaching a folder, and focusing the destructive answer hands that
                  keystroke straight back. */}
              <div className="settings-actions">
                <Button onClick={() => setConfirmingDetach(false)} autoFocus>Cancel</Button>
                <Button variant="danger" onClick={onDetachFolder}>
                  <Unlink size={15} /> Detach
                </Button>
              </div>
            </div>
          ) : (
            <div className="settings-actions">
              <Button onClick={onChangeFolder}>
                <FolderOpen size={16} /> Change folder…
              </Button>
              <Button variant="subtle" onClick={() => setConfirmingDetach(true)}>
                <Unlink size={15} /> Detach…
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
