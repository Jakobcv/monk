import { useState } from "react";
import { FolderOpen, Unlink } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { THEME_MODES } from "./lib/themeMode";
import { READING_TYPES } from "./lib/readingType";

const THEME_LABELS = { light: "Light", dark: "Dark", system: "System" };
const READING_LABELS = { sans: "Sans", serif: "Serif" };

// A set of exclusive options, so it's a radiogroup rather than a row of buttons: one tab stop, and
// the arrow keys move the selection (WAI-ARIA APG). Choosing applies on the spot — there is
// nothing to validate, and the whole point of each choice is how the app then looks.
function Choice({ label, options, labels, value, onChange }) {
  const move = (step) => {
    const i = options.indexOf(value);
    onChange(options[(i + step + options.length) % options.length]);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };
  return (
    <div className="seg" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          tabIndex={value === option ? 0 : -1}
          className="seg__option"
          data-selected={value === option ? "" : undefined}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

// Everything a person can change about Monk, which is four things: how it looks (the theme, and
// the typeface of their own words), and the two folder actions that used to sit in the top bar.
export default function Settings({ themeMode, onThemeModeChange, readingType, onReadingTypeChange, folderLabel, onChangeFolder, onDetachFolder, onClose }) {
  const [confirmingDetach, setConfirmingDetach] = useState(false);

  return (
    <Modal title="Settings" onClose={onClose} width={460}>
      <div className="settings-group">
        <div className="settings-row">
          <label className="settings-label" id="settings-theme-label">Theme</label>
          <Choice label="Theme" options={THEME_MODES} labels={THEME_LABELS} value={themeMode} onChange={onThemeModeChange} />
        </div>
        <p className="settings-hint">
          {themeMode === "system" ? "Following your desktop." : "Set here, whatever your desktop says."}
        </p>
      </div>

      <div className="settings-group settings-group--divided">
        <div className="settings-row">
          <span className="settings-label">Text</span>
          <Choice label="Text" options={READING_TYPES} labels={READING_LABELS} value={readingType} onChange={onReadingTypeChange} />
        </div>
        <p className="settings-hint">
          {readingType === "serif"
            ? "Titles and the writing on a page are set in a serif. Everything else stays as it is."
            : "Titles and the writing on a page are set in the same sans as the rest of Monk."}
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
            <div className="settings-confirm" role="group" aria-label="Confirm detaching this repository">
              <p className="settings-confirm__text">
                Detach this repository? Monk forgets it and returns to the start screen. Nothing on disk changes.
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
                <FolderOpen size={16} /> Change repository…
              </Button>
              <Button variant="subtle" onClick={() => setConfirmingDetach(true)}>
                <Unlink size={15} /> Detach repository…
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
