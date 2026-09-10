import { Plus, Radio } from "lucide-react";
import Logo from "./Logo";
import { font, INK, SIZE, WEIGHT, LEADING, SPACE, BRAND_GRADIENT } from "./lib/theme";
import Button from "./ui/Button";

// The landing page — logo, wordmark, and the two things you'd actually come here to do.
// "Add Signal" has no destination yet (there's no board to add it to without picking a spec
// first) — it's a placeholder for a future quick-capture flow, disabled for now.
export default function Home({ onCreateSpec }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: SPACE["5xl"], boxSizing: "border-box" }}>
      <div className="enter-up" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <Logo size={68} />
          <h1
            style={{
              fontFamily: font, fontWeight: WEIGHT.black, fontSize: SIZE.display,
              letterSpacing: "-0.03em", margin: 0, lineHeight: LEADING.tight,
              background: BRAND_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text",
              color: "transparent", WebkitTextFillColor: "transparent",
            }}
          >
            monk
          </h1>
        </div>

        <div style={{ display: "flex", gap: SPACE.lg, marginTop: SPACE["4xl"] }}>
          <Button variant="primary" size="md" onClick={onCreateSpec}>
            <Plus size={14} /> Create spec
          </Button>
          <Button variant="secondary" size="md" disabled title="Coming soon" style={{ color: INK }}>
            <Radio size={14} /> Add Signal
          </Button>
        </div>
      </div>
    </div>
  );
}
