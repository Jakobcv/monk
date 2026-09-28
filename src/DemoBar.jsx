import Button from "./ui/Button";

// The demo's standing reminder, along the bottom of the window on every page: nothing made here is
// kept. It is a landmark rather than a live region — it is there from the moment the demo opens and
// never changes, so announcing it on every route change would only be noise.
//
// It sits in the app's flex column rather than being fixed over it, so it takes its own space and
// never covers the bottom of a page or a focused control. The toast moves up to clear it (index.css).
//
// Connect is only offered where the browser can open a folder; Leave always is.
export default function DemoBar({ canConnect, onConnect, onLeave }) {
  return (
    <section className="demo-bar" aria-label="Demo">
      <div className="demo-bar__text">
        <strong className="demo-bar__title">You’re trying a demo of Monk.</strong>{" "}
        <span className="demo-bar__detail">Nothing you make here is kept — a reload starts it over.</span>
      </div>
      <div className="demo-bar__actions">
        {canConnect && (
          <Button variant="primary" onClick={onConnect}>Connect your repository…</Button>
        )}
        <Button onClick={onLeave}>Leave demo</Button>
      </div>
    </section>
  );
}
