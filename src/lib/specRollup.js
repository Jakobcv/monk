import { SPEC_STATUS_OPTIONS } from "./theme";

// How many of `specs` are at each status, in status order: [[status, n], …], zeros included.
// The initiative page's side rail and the Initiatives page's rows both count from here.
export const specStatusCounts = (specs) =>
  SPEC_STATUS_OPTIONS.map((s) => [s, specs.filter((x) => x.status === s).length]);

export const shippedCount = (specs) => specs.filter((s) => s.status === "shipped").length;
