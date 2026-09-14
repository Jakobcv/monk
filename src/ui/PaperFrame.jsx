import Breadcrumbs from "../Breadcrumbs";
import PageTabs from "./PageTabs";
import { PageKind, PageTitle } from "./text";

// The frame a spec, a research plan and an initiative share: breadcrumbs across the top, then the
// record's kind, its title and a tab bar, the body (a sheet on the reading desk, or a board), and the
// side rail. It used to be written out by hand on each of the three pages, and the copies drifted —
// the title block sat on a different gutter than the breadcrumbs, and the initiative, which has no
// tabs, drew its hairline 34px higher than the other two. Written once, neither can happen.
//
// - A page without `tabs` (an initiative) gets no tab row: its title block just ends in a hairline
//   of its own. There's no reason for it to be as tall as a page that has tabs.
// - The breadcrumb bar spans the rail too, so its hairline runs the full width.
// - When the frame gets narrow (a split-screen window), the rail stops being a column beside the
//   body and becomes a wrapping strip under the tabs. That's a container query on the frame in
//   index.css, not a viewport media query: what matters is the room left once the app's sidebar has
//   taken its share, not how wide the window is.
export default function PaperFrame({
  breadcrumbs, kindIcon, kind, title, onTitleChange, titlePlaceholder,
  tabs = null, activeTab, tabHref, rail, children,
}) {
  return (
    <div className="paper-frame">
      <div className="paper-frame__grid">
        <div className="paper-frame__crumbs">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <div className={tabs ? "paper-frame__head" : "paper-frame__head paper-frame__head--untabbed"}>
          <PageKind icon={kindIcon}>{kind}</PageKind>
          <PageTitle value={title} onChange={onTitleChange} placeholder={titlePlaceholder} />
          {tabs && <PageTabs tabs={tabs} activeTab={activeTab} tabHref={tabHref} />}
        </div>
        {/* `hidden` panels inside toggle with the attribute; see the note in index.css. */}
        <div className="paper-frame__body">{children}</div>
        <div className="paper-frame__rail">{rail}</div>
      </div>
    </div>
  );
}
