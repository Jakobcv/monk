// A record with `patch` applied and its `updatedAt` moved — or the record itself, untouched, when the
// patch changes nothing. Pages report their whole state back as they mount (the Solution tab and the
// Analysis board both do), and stamping `updatedAt` on that rewrote a file nobody had touched, which
// is the one thing a save is meant never to do.
export const patched = (record, patch) => (
  Object.keys(patch).some((k) => JSON.stringify(record[k]) !== JSON.stringify(patch[k]))
    ? { ...record, ...patch, updatedAt: Date.now() }
    : record
);
