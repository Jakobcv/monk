// Every full page in the app is one of these. Before it, a page was a bare <div> that each file
// re-declared — its own height, its own scroll container, its own padding, and its own answer to
// what colour it sat on. Five files answered that last one by omission and inherited the ground
// from `body`; two painted themselves white instead, one of them putting fourteen white cards on
// a white page. Nothing could catch it, because there was no shared thing to be inconsistent
// with. That is what this exists to be.
//
// Grounds (see the Grounds block in lib/theme.js) — a page takes one, never white:
//
//   ground="app"      the default: lists, boards, the start page, a document
//   ground="reading"  the desk behind a sheet of paper — a spec's writing tabs
//
// Shapes:
//
//   <Page>                          scrolls, standard page padding
//   <Page landing>                  the same, dropped further down the viewport (Home)
//   <Page header={<Breadcrumbs/>}>  a pinned header above a scrolling body, which is then
//                                   padded a step tighter at the top since the header spaces it
//   <Page bleed>                    fills its height, no padding, manages its own scrolling —
//                                   for canvases (the Discovery board), not for reading
//
// Everything visual lives in .page (index.css) so hover/focus states and the media query can
// reach it; the padding and the grounds come from PAGE and the BG_* tokens.
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function Page({
  ground = "app",
  header = null,
  landing = false,
  bleed = false,
  className,
  children,
  ...rest
}) {
  const cls = cx(
    "page",
    `page--${ground}`,
    landing && "page--landing",
    bleed && "page--bleed",
    header && "page--under-header",
    className,
  );

  // With a header, the page is the scrolling half of a frame rather than the whole thing —
  // `hidden` and the rest of the props belong to the frame, since that is the element whose
  // presence the caller is controlling.
  if (header) {
    return (
      <div className="page-frame" {...rest}>
        {header}
        <div className={cls}>{children}</div>
      </div>
    );
  }
  return <div className={cls} {...rest}>{children}</div>;
}
