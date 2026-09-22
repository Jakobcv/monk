// Picking one file off the person's machine to bring into the workspace — a source to upload, a
// sketch to add. `showOpenFilePicker` where it exists (Chrome and Edge, which Monk needs anyway
// for the folder), and a plain `<input type="file">` everywhere else, created fresh each time so
// there is nothing to mount and no ref to manage between picks.
//
// Resolves null when the person cancels the input fallback; the native picker throws AbortError
// instead, which every caller already lets through as "changed their mind".

// A kind of file a picker can be narrowed to. `picker` is the File System Access API's shape,
// `accept` the input element's — the same restriction said twice because the two APIs disagree
// about how to say it.
export const IMAGE_FILES = {
  picker: [{
    description: "Images",
    accept: { "image/*": [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"] },
  }],
  accept: "image/*",
};

export async function pickFile(kind) {
  if (typeof window !== "undefined" && "showOpenFilePicker" in window) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      ...(kind ? { types: kind.picker, excludeAcceptAllOption: false } : {}),
    });
    return handle.getFile();
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (kind) input.accept = kind.accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
