// Put `item` back at `index` in a *current* copy of the list, rather than restoring a whole
// snapshot of it. That distinction is what makes undo safe: anything else the user changed in
// the seconds between the delete and hitting Undo survives, because undo only ever re-inserts
// the one thing that was removed.
export function insertAt(list, index, item) {
  const next = [...(list || [])];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}
