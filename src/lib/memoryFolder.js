// A folder that lives only in this tab's memory, shaped like the File System Access handles
// storage.js is written against — for the demo, which has no folder behind it.
//
// Only what storage.js calls is here: getDirectoryHandle / getFileHandle (with `create`),
// entries, removeEntry (with `recursive`), createWritable → write / close, getFile, and the
// `kind` and `name` properties. Implementing that surface rather than giving the demo a store of
// its own is the point: the demo then loads, saves, uploads and draws sketches through exactly the
// code a connected folder does, so a page can't quietly work in one and not the other. It also
// needs nothing from the browser but `File`, which is why the demo runs in Firefox and Safari.
//
// `onChange`, set on the folder, is called whenever a file's bytes change or a file is removed —
// not on every write, since a save that rewrites a file with what was already there changes nothing.
// That is how the demo knows the person has made something they'd lose.
//
// Errors carry the DOMException names the real API throws (NotFoundError, TypeMismatchError,
// InvalidModificationError), since callers only ever check for "it threw".

// The real getFile() types a file by its extension, and a sketch is drawn from a blob URL, which
// serves that type — an SVG with no type is not drawn at all.
const TYPES = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", md: "text/markdown", txt: "text/plain", json: "application/json", csv: "text/csv" };
const typeOf = (name) => TYPES[name.slice(name.lastIndexOf(".") + 1).toLowerCase()] || "";
const makeFile = (parts, name) => new File(parts, name, { type: typeOf(name), lastModified: Date.now() });

const notFound = (name) => new DOMException(`"${name}" was not found.`, "NotFoundError");
const typeMismatch = (name) => new DOMException(`"${name}" is not the kind of entry asked for.`, "TypeMismatchError");

async function sameBytes(a, b) {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]).then((bufs) => bufs.map((buf) => new Uint8Array(buf)));
  return x.every((byte, i) => byte === y[i]);
}
const holdsAFile = (entry) => entry.kind === "file" || [...entry._entries.values()].some(holdsAFile);

class MemoryFileHandle {
  constructor(name, root, file) {
    this.kind = "file";
    this.name = name;
    this._root = root;
    this._file = file ?? makeFile([], name);
  }

  async getFile() {
    return this._file;
  }

  // Buffers until close, like the real writable — a reader never sees half a write.
  async createWritable() {
    const parts = [];
    return {
      write: async (data) => { parts.push(data); },
      close: async () => {
        const next = makeFile(parts, this.name);
        const changed = !(await sameBytes(this._file, next));
        this._file = next;
        if (changed) this._root.onChange?.();
      },
    };
  }
}

class MemoryDirectoryHandle {
  constructor(name, root) {
    this.kind = "directory";
    this.name = name;
    this._root = root || this;
    this._entries = new Map();
    this.onChange = null; // read on the root only
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const entry = this._entries.get(name);
    if (entry) {
      if (entry.kind !== "directory") throw typeMismatch(name);
      return entry;
    }
    if (!create) throw notFound(name);
    const dir = new MemoryDirectoryHandle(name, this._root);
    this._entries.set(name, dir);
    return dir;
  }

  async getFileHandle(name, { create = false } = {}) {
    const entry = this._entries.get(name);
    if (entry) {
      if (entry.kind !== "file") throw typeMismatch(name);
      return entry;
    }
    if (!create) throw notFound(name);
    const file = new MemoryFileHandle(name, this._root);
    this._entries.set(name, file);
    return file;
  }

  async removeEntry(name, { recursive = false } = {}) {
    const entry = this._entries.get(name);
    if (!entry) throw notFound(name);
    if (entry.kind === "directory" && entry._entries.size && !recursive) {
      throw new DOMException(`"${name}" is not empty.`, "InvalidModificationError");
    }
    this._entries.delete(name);
    if (holdsAFile(entry)) this._root.onChange?.();
  }

  // A snapshot, so removing an entry mid-iteration (saveWorkspace's cleanup does) is safe.
  async *entries() {
    for (const pair of [...this._entries]) yield pair;
  }
}

// A folder named `name` holding `files`: { "<path/with/slashes>": string | Blob }.
export function memoryFolder(name, files = {}) {
  const root = new MemoryDirectoryHandle(name);
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    const fileName = parts.pop();
    let dir = root;
    for (const part of parts) {
      let next = dir._entries.get(part);
      if (!next) { next = new MemoryDirectoryHandle(part, root); dir._entries.set(part, next); }
      dir = next;
    }
    dir._entries.set(fileName, new MemoryFileHandle(fileName, root, makeFile([content], fileName)));
  }
  return root;
}
