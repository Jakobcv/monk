import logoRaw from "./assets/logo.svg?raw";
import { BRAND } from "./lib/theme";

// The logo is inlined directly into the DOM (via a raw import) rather than referenced as a
// CSS mask-image/background — a mask needs the browser to fetch the SVG as a separate resource,
// and when that fails to resolve (MIME type, timing, whatever) the fallback isn't "nothing", it's
// "no mask at all" — the whole background box shows through as a plain square. Inlining removes
// that failure mode entirely: there's no external resource to fail to load. The gradient is a
// real SVG `<linearGradient>`, referenced from the inlined path via a plain CSS rule (which wins
// over the source file's own `fill="#000000"` attribute — CSS always beats presentation attributes).
const BRAND_GRADIENT_STOPS = BRAND;

export default function Logo({ size = 64 }) {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="monk-brand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={BRAND_GRADIENT_STOPS.from} />
            <stop offset="100%" stopColor={BRAND_GRADIENT_STOPS.to} />
          </linearGradient>
        </defs>
      </svg>
      <style>{`
        .monk-logo-mark { flex-shrink: 0; }
        .monk-logo-mark svg { display: block; width: 100%; height: 100%; }
        .monk-logo-mark path { fill: url(#monk-brand-gradient); }
      `}</style>
      <div className="monk-logo-mark" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: logoRaw }} />
    </>
  );
}
