export const font = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";

export const INK = "#37352F";       // primary text, Notion's near-black
export const INK_SOFT = "#787774";  // secondary text / labels
export const INK_FAINT = "#A9A9A5"; // placeholders
export const BORDER = "#E9E9E7";    // hairline column / card border
export const BORDER_STRONG = "#DDDBD6";
export const BG = "#FFFFFF";
export const BG_SIDEBAR = "#FBFBFA";
export const BG_HOVER = "#F7F7F5";

// accent used sparingly: a small dot in the column header, the connector line, and the drag handle
export const ACCENT = {
  signal: "#D9730D",  // amber
  insight: "#2383E2", // blue
  action: "#0F7B6C",  // teal
  result: "#AD1A72",  // rose
};

export const STATUS_OPTIONS = ["Not started", "In progress", "Blocked", "Done"];
export const STATUS_COLOR = { "Not started": INK_FAINT, "In progress": "#2383E2", "Blocked": "#E03E3E", "Done": "#0F7B6C" };
export const IMPACT_OPTIONS = ["Low", "Medium", "High"];
export const IMPACT_COLOR = { Low: INK_FAINT, Medium: "#D9730D", High: "#E03E3E" };

// how the research behind this board (this Activity) was conducted
export const METHOD_OPTIONS = ["Interview", "Survey", "Usage metrics", "Client call", "Other"];

export const SAVE_STATUS_COLOR = { saved: "#0F7B6C", saving: INK_FAINT, error: "#E03E3E", idle: INK_FAINT };
export const SAVE_STATUS_LABEL = { saved: "Saved", saving: "Saving…", error: "Save failed — retry", idle: "" };
