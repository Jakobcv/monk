import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { mockWorkspace } from "./lib/mockWorkspace";
import {
  font, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, CITED, SIZE, WEIGHT, SPACE, RADIUS,
  SPEC_STATUS_COLOR,
} from "./lib/theme";
import { pageHeading, eyebrow, meta } from "./ui/text";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Sparkline from "./ui/Sparkline";
import Bars from "./ui/Bars";
import Donut from "./ui/Donut";
import {
  inventory, funnel, synthesis, mostReusedInsight, statusSplit, SPEC_STATUS_ORDER,
  INITIATIVE_STATUS_ORDER, acceptanceProgress, openQuestions, momentum, staleSpecs,
  recentlyTouched, relativeTime, countPerWeek, cumulative,
} from "./lib/dashboardMetrics";

const FUNNEL_COLOR = { signal: ACCENT.signal, insight: ACCENT.insight, spec: ACTIVITY, shipped: ACCENT.action };
const INITIATIVE_COLOR = { active: ACCENT.action, paused: CITED, done: INK_FAINT };
const KIND_COLOR = { signal: ACCENT.signal, insight: ACCENT.insight, spec: ACTIVITY, activity: ACTIVITY, initiative: ACCENT.action };

const NUM = { fontFamily: font, fontWeight: WEIGHT.bold, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" };
const pct = (r) => `${Math.round(r * 100)}%`;
const sum = (a) => a.reduce((x, y) => x + y, 0);

// --- building blocks ------------------------------------------------------
function CardHead({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.base, marginBottom: SPACE.xl }}>
      <div style={{ ...eyebrow, fontSize: SIZE.xs, letterSpacing: "0.07em" }}>{children}</div>
      {note && <span style={{ ...meta, fontSize: SIZE.sm }}>{note}</span>}
    </div>
  );
}

// A headline stat — two of these sit side by side, nothing wider than a pair.
function Stat({ label, value, accent = INK, spark, sub }) {
  return (
    <Card padded style={{ flex: 1, minWidth: 0, padding: "18px 20px" }}>
      <div style={{ ...eyebrow, fontSize: SIZE.xs, letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ ...NUM, fontSize: "44px", color: accent, marginTop: SPACE.base }}>{value}</div>
      {spark && <div style={{ marginTop: SPACE.md }}><Sparkline data={spark.data} color={spark.color} height={40} strokeWidth={2} /></div>}
      {sub && <div style={{ ...meta, fontSize: SIZE.sm, marginTop: spark ? SPACE.md : SPACE.sm }}>{sub}</div>}
    </Card>
  );
}

function StatRow({ children }) {
  return <div style={{ display: "flex", gap: "16px" }}>{children}</div>;
}

function LegendRow({ color, label, value, big }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACE.md, fontFamily: font, fontSize: big ? SIZE.body : SIZE.ui }}>
      <span style={{ width: big ? "10px" : "9px", height: big ? "10px" : "9px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: INK_SOFT, flex: 1, textTransform: "capitalize" }}>{label}</span>
      <span style={{ ...NUM, fontWeight: WEIGHT.semibold, fontSize: big ? SIZE.lg : SIZE.md, color: INK }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent = INK }) {
  return (
    <div style={{ flex: 1, minWidth: "120px" }}>
      <div style={{ ...NUM, fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: accent }}>{value}</div>
      <div style={{ ...meta, fontSize: SIZE.sm, marginTop: "3px" }}>{label}</div>
    </div>
  );
}

// --- the dashboard -------------------------------------------------------
export default function Home({ signals = [], insights = [], activities = [], specs = [], initiatives = [], sections = [], onCreateSpec, demo = false }) {
  // `sample` swaps the whole dashboard over to generated data — for seeing it populated even
  // with a real (possibly new/sparse) folder connected. `demo` forces it on for the
  // #/dashboard-preview route.
  const [sample, setSample] = useState(demo);
  const real = { signals, insights, activities, specs, initiatives, sections };
  const mock = useMemo(() => mockWorkspace(1), []);
  const data = sample ? mock : real;

  // Fixed for the component's life so week buckets / relative times don't jitter on re-render;
  // the sample set is anchored to its own generation date.
  const [nowReal] = useState(() => Date.now());
  const now = sample ? Date.UTC(2026, 8, 10) : nowReal;

  const inv = inventory(data);
  const fun = funnel(data);
  const funMax = Math.max(...fun.map((s) => s.value), 1);
  const syn = synthesis(data);
  const reused = mostReusedInsight(data);
  const specStatus = statusSplit(data.specs, SPEC_STATUS_ORDER);
  const iniStatus = statusSplit(data.initiatives, INITIATIVE_STATUS_ORDER);
  const acc = acceptanceProgress(data);
  const oq = openQuestions(data);
  const mo = momentum(data, 12, now);
  const stale = staleSpecs(data, 21, now);
  const recent = recentlyTouched(data, 7);

  const spark = (items, color) => ({ data: cumulative(countPerWeek(items, "createdAt", 14, now)), color });

  // The feed — one column, cards top to bottom, each animating up on load.
  const feed = [
    <StatRow key="s1">
      <Stat label="Signals" value={inv.signals} accent={ACCENT.signal} spark={spark(data.signals, ACCENT.signal)} sub="observations captured" />
      <Stat label="Insights" value={inv.insights} accent={ACCENT.insight} spark={spark(data.insights, ACCENT.insight)} sub="synthesised findings" />
    </StatRow>,

    <StatRow key="s2">
      <Stat label="Activities" value={inv.activities} accent={ACTIVITY} spark={spark(data.activities, ACTIVITY)} sub="research efforts" />
      <Stat label="Specs" value={inv.specs} accent={INK} spark={spark(data.specs, INK_FAINT)} sub={`${inv.initiatives} initiatives · ${inv.docs} KB docs`} />
    </StatRow>,

    <Card key="pipe" padded style={{ padding: "22px 24px" }}>
      <CardHead>Pipeline</CardHead>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
        {fun.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: SPACE.xl }}>
            <span style={{ width: "68px", fontFamily: font, fontSize: SIZE.ui, color: INK_SOFT, textAlign: "right", flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, height: "30px", background: "var(--bg-hover)", borderRadius: RADIUS.sm, overflow: "hidden" }}>
              <div className="reveal-x" style={{ width: `${Math.max(2, (s.value / funMax) * 100)}%`, height: "100%", background: FUNNEL_COLOR[s.key], borderRadius: RADIUS.sm }} />
            </div>
            <span style={{ ...NUM, width: "40px", fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: INK, flexShrink: 0 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </Card>,

    <Card key="syn" padded style={{ padding: "22px 24px" }}>
      <CardHead note={`${pct(syn.synthesisRate)} synthesised`}>Signal synthesis</CardHead>
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md, marginBottom: SPACE.lg }}>
        <span style={{ ...NUM, fontSize: "44px", color: syn.unsynthesized > 0 ? CITED : ACCENT.action }}>{syn.unsynthesized}</span>
        <span style={{ ...meta, fontSize: SIZE.body }}>of {syn.totalSignals} signals not yet in an insight</span>
      </div>
      <div style={{ display: "flex", height: "14px", borderRadius: RADIUS.pill, overflow: "hidden", background: "var(--bg-hover)" }}>
        {[{ v: syn.synthesized, c: ACCENT.insight }, { v: syn.unsynthesized, c: "var(--border-strong)" }].map((s, i) => s.v > 0 && (
          <div key={i} className="reveal-x" style={{ flex: s.v, background: s.c, animationDelay: `${i * 110}ms` }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xl, marginTop: SPACE.xl }}>
        <MiniStat label="Evidence-backed insights" value={pct(syn.evidenceRatio)} />
        <MiniStat label="Avg signals / insight" value={syn.avgEvidence.toFixed(1)} />
        {reused && <MiniStat label="Most reused insight" value={`${reused.count} specs`} />}
      </div>
    </Card>,

    <Card key="mom" padded style={{ padding: "22px 24px" }}>
      <CardHead note="last 12 weeks">Momentum</CardHead>
      <Bars
        height={168}
        series={[
          { values: mo.signals, color: ACCENT.signal },
          { values: mo.insights, color: ACCENT.insight },
        ]}
      />
      <div style={{ display: "flex", gap: SPACE.xl, marginTop: SPACE.lg }}>
        <LegendDot color={ACCENT.signal} label={`Signals · ${sum(mo.signals)}`} />
        <LegendDot color={ACCENT.insight} label={`Insights · ${sum(mo.insights)}`} />
      </div>
    </Card>,

    <Card key="del" padded style={{ padding: "22px 24px" }}>
      <CardHead>Delivery</CardHead>
      <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE["2xl"] }}>
          <Donut
            size={148} thickness={17}
            segments={specStatus.map((s) => ({ value: s.value, color: SPEC_STATUS_COLOR[s.key] }))}
            center={<>
              <span style={{ ...NUM, fontSize: "26px", color: INK }}>{data.specs.length}</span>
              <span style={{ ...meta, fontSize: SIZE.sm }}>specs</span>
            </>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md, minWidth: "120px" }}>
            {specStatus.map((s) => <LegendRow key={s.key} big color={SPEC_STATUS_COLOR[s.key]} label={s.key} value={s.value} />)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE["2xl"] }}>
          <Donut
            size={148} thickness={17}
            segments={[{ value: acc.ratio, color: ACCENT.action }, { value: Math.max(0, 1 - acc.ratio), color: "transparent" }]}
            center={<span style={{ ...NUM, fontSize: "26px", color: INK }}>{pct(acc.ratio)}</span>}
          />
          <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK_SOFT, lineHeight: 1.6 }}>
            <span style={{ ...NUM, fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: INK }}>{acc.done} / {acc.total}</span><br />
            acceptance criteria met<br />
            across {acc.specs} spec{acc.specs === 1 ? "" : "s"} in flight
          </div>
        </div>
      </div>
    </Card>,

    <StatRow key="s3">
      <Stat
        label="Open questions"
        value={oq.open}
        accent={oq.open > 0 ? CITED : ACCENT.action}
        sub={oq.open > 0 ? `unresolved across ${oq.specs} spec${oq.specs === 1 ? "" : "s"}` : "nothing outstanding"}
      />
      <Card padded style={{ flex: 1, minWidth: 0, padding: "18px 20px" }}>
        <div style={{ ...eyebrow, fontSize: SIZE.xs, letterSpacing: "0.07em", marginBottom: SPACE.lg }}>Initiatives</div>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          {iniStatus.map((s) => <LegendRow key={s.key} big color={INITIATIVE_COLOR[s.key]} label={s.key} value={s.value} />)}
        </div>
      </Card>
    </StatRow>,

    <Card key="stale" padded style={{ padding: "22px 24px" }}>
      <CardHead>Stale active specs</CardHead>
      {stale.length === 0 ? (
        <div style={{ ...meta, fontSize: SIZE.body, lineHeight: 1.5 }}>Every active spec was touched in the last three weeks.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
          {stale.slice(0, 6).map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.lg, fontFamily: font, fontSize: SIZE.body }}>
              <span style={{ color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "Untitled spec"}</span>
              <span style={{ ...meta, fontSize: SIZE.sm, flexShrink: 0 }}>{relativeTime(s.updatedAt, now)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>,

    <Card key="recent" padded style={{ padding: "22px 24px" }}>
      <CardHead>Recently touched</CardHead>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
        {recent.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: SPACE.md, fontFamily: font, fontSize: SIZE.body }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: KIND_COLOR[r.kind] || INK_FAINT, flexShrink: 0 }} />
            <span style={{ ...meta, fontSize: SIZE.xs, width: "58px", flexShrink: 0, textTransform: "capitalize" }}>{r.kind}</span>
            <span style={{ color: INK, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ ...meta, fontSize: SIZE.sm, flexShrink: 0 }}>{relativeTime(r.updatedAt, now)}</span>
          </div>
        ))}
      </div>
    </Card>,
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "36px 40px 64px", background: "var(--bg)" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <div className="enter-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.lg, flexWrap: "wrap", marginBottom: "28px" }}>
          <div>
            <h1 style={{ ...pageHeading, fontSize: "26px", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: SPACE.base }}>
              Overview
              {sample && (
                <button
                  onClick={() => !demo && setSample(false)}
                  title={demo ? "Sample data" : "Switch back to your data"}
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", ...meta, fontSize: SIZE.xs, color: ACCENT.insight, background: "none", border: `1px solid ${ACCENT.insight}44`, borderRadius: RADIUS.pill, padding: "2px 9px", cursor: demo ? "default" : "pointer" }}
                >
                  <Sparkles size={11} /> Sample data{!demo && " ✕"}
                </button>
              )}
            </h1>
            <div style={{ ...meta, fontSize: SIZE.sm, marginTop: "6px" }}>
              {inv.specs} specs · {inv.signals} signals · {inv.insights} insights · {inv.activities} activities
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg }}>
            {!sample && (
              <button
                onClick={() => setSample(true)}
                className="btn btn--sm btn--subtle"
                title="See the dashboard populated with generated data"
              >
                <Sparkles size={12} /> Preview with sample data
              </button>
            )}
            {onCreateSpec && (
              <Button variant="primary" size="md" onClick={onCreateSpec}>
                <Plus size={14} /> New spec
              </Button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {feed.map((row, i) => (
            <div key={row.key} className="enter-up" style={{ animationDelay: `${Math.min(i * 55, 440)}ms`, animationFillMode: "backwards" }}>
              {row}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm, fontFamily: font, fontSize: SIZE.ui, color: INK_SOFT }}>
      <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: color }} /> {label}
    </span>
  );
}
