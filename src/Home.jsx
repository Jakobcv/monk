import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
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

const pct = (r) => `${Math.round(r * 100)}%`;

// --- small building blocks --------------------------------------------------
function Tile({ label, value, sub, accent = INK, spark, span }) {
  return (
    <Card padded style={span ? { gridColumn: `span ${span}` } : undefined}>
      <div style={eyebrow}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.base, marginTop: SPACE.sm }}>
        <span style={{ fontFamily: font, fontWeight: WEIGHT.bold, fontSize: "27px", lineHeight: 1, color: accent }}>{value}</span>
        {spark && <div style={{ width: "96px", flexShrink: 0 }}>{spark}</div>}
      </div>
      {sub && <div style={{ ...meta, marginTop: SPACE.sm }}>{sub}</div>}
    </Card>
  );
}

function CardHead({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.base, marginBottom: SPACE.lg }}>
      <div style={eyebrow}>{children}</div>
      {note && <span style={{ ...meta }}>{note}</span>}
    </div>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, fontFamily: font, fontSize: SIZE.sm }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: INK_SOFT, flex: 1, textTransform: "capitalize" }}>{label}</span>
      <span style={{ color: INK, fontWeight: WEIGHT.semibold }}>{value}</span>
    </div>
  );
}

function TrackBar({ segments }) {
  return (
    <div style={{ display: "flex", height: "8px", borderRadius: RADIUS.pill, overflow: "hidden", background: "var(--bg-hover)" }}>
      {segments.map((s, i) => s.value > 0 && (
        <div key={i} className="reveal-x" style={{ flex: s.value, background: s.color, animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

// --- the dashboard --------------------------------------------------------
export default function Home({ signals = [], insights = [], activities = [], specs = [], initiatives = [], sections = [], onCreateSpec, demo = false }) {
  // Fixed for the component's life so the week buckets and relative times don't jitter on
  // re-render; a fresh mount (route change) re-reads it.
  const [now] = useState(() => (demo ? Date.UTC(2026, 8, 10) : Date.now()));
  const data = { signals, insights, activities, specs, initiatives, sections };

  const inv = inventory(data);
  const fun = funnel(data);
  const funMax = Math.max(...fun.map((s) => s.value), 1);
  const syn = synthesis(data);
  const reused = mostReusedInsight(data);
  const specStatus = statusSplit(specs, SPEC_STATUS_ORDER);
  const iniStatus = statusSplit(initiatives, INITIATIVE_STATUS_ORDER);
  const acc = acceptanceProgress(data);
  const oq = openQuestions(data);
  const mo = momentum(data, 10, now);
  const stale = staleSpecs(data, 21, now);
  const recent = recentlyTouched(data, 6);

  const spark = (items, color) => (
    <Sparkline data={cumulative(countPerWeek(items, "createdAt", 12, now))} color={color} />
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "32px 40px 48px", background: "var(--bg)" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div className="enter-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.lg, flexWrap: "wrap", marginBottom: "26px" }}>
          <div>
            <h1 style={{ ...pageHeading, fontSize: "22px", display: "flex", alignItems: "center", gap: SPACE.base }}>
              Overview
              {demo && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", ...meta, color: ACCENT.insight, border: `1px solid ${ACCENT.insight}44`, borderRadius: RADIUS.pill, padding: "1px 8px" }}>
                  <Sparkles size={10} /> Sample data
                </span>
              )}
            </h1>
            <div style={{ ...meta, marginTop: "4px" }}>{inv.specs} specs · {inv.signals} signals · {inv.insights} insights · {inv.activities} activities</div>
          </div>
          {onCreateSpec && (
            <Button variant="primary" size="md" onClick={onCreateSpec}>
              <Plus size={14} /> New spec
            </Button>
          )}
        </div>

        <div
          className="enter-up"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "14px", alignItems: "start" }}
        >
          {/* ---- group 1: inventory ---- */}
          <Tile label="Signals" value={inv.signals} accent={ACCENT.signal} spark={spark(signals, ACCENT.signal)} sub="observations captured" />
          <Tile label="Insights" value={inv.insights} accent={ACCENT.insight} spark={spark(insights, ACCENT.insight)} sub="synthesised findings" />
          <Tile label="Activities" value={inv.activities} accent={ACTIVITY} spark={spark(activities, ACTIVITY)} sub="research efforts" />
          <Tile label="Specs" value={inv.specs} accent={INK} spark={spark(specs, INK_FAINT)} sub={`${inv.initiatives} initiatives · ${inv.docs} KB docs`} />

          {/* pipeline funnel */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead>Pipeline</CardHead>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.base }}>
              {fun.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: SPACE.lg }}>
                  <span style={{ width: "56px", ...meta, textAlign: "right", flexShrink: 0 }}>{s.label}</span>
                  <div style={{ flex: 1, height: "20px", background: "var(--bg-hover)", borderRadius: RADIUS.xs, overflow: "hidden" }}>
                    <div className="reveal-x" style={{ width: `${Math.max(3, (s.value / funMax) * 100)}%`, height: "100%", background: FUNNEL_COLOR[s.key], borderRadius: RADIUS.xs }} />
                  </div>
                  <span style={{ width: "28px", fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, color: INK, flexShrink: 0 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ---- group 2: synthesis health ---- */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead note={`${pct(syn.synthesisRate)} synthesised`}>Signal synthesis</CardHead>
            <div style={{ display: "flex", alignItems: "flex-end", gap: SPACE.base, marginBottom: SPACE.md }}>
              <span style={{ fontFamily: font, fontWeight: WEIGHT.bold, fontSize: "27px", lineHeight: 1, color: syn.unsynthesized > 0 ? CITED : ACCENT.action }}>{syn.unsynthesized}</span>
              <span style={{ ...meta, marginBottom: "3px" }}>of {syn.totalSignals} signals not yet in an insight</span>
            </div>
            <TrackBar segments={[{ value: syn.synthesized, color: ACCENT.insight }, { value: syn.unsynthesized, color: "var(--border-strong)" }]} />
            <div style={{ display: "flex", gap: SPACE["2xl"], marginTop: SPACE.lg }}>
              <MiniStat label="Evidence-backed insights" value={pct(syn.evidenceRatio)} />
              <MiniStat label="Avg signals / insight" value={syn.avgEvidence.toFixed(1)} />
              {reused && <MiniStat label="Most reused insight" value={`${reused.count} specs`} />}
            </div>
          </Card>

          {/* ---- group 4: status & progress ---- */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead>Spec status</CardHead>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE["3xl"] }}>
              <Donut
                segments={specStatus.map((s) => ({ value: s.value, color: SPEC_STATUS_COLOR[s.key] }))}
                center={<>
                  <span style={{ fontFamily: font, fontWeight: WEIGHT.bold, fontSize: "20px", color: INK }}>{specs.length}</span>
                  <span style={{ ...meta, fontSize: SIZE.micro }}>specs</span>
                </>}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, flex: 1, minWidth: 0 }}>
                {specStatus.map((s) => <LegendRow key={s.key} color={SPEC_STATUS_COLOR[s.key]} label={s.key} value={s.value} />)}
              </div>
            </div>
          </Card>

          {/* acceptance criteria ring */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead>Acceptance criteria</CardHead>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE["3xl"] }}>
              <Donut
                size={104} thickness={12}
                segments={[{ value: acc.ratio, color: ACCENT.action }, { value: Math.max(0, 1 - acc.ratio), color: "transparent" }]}
                center={<span style={{ fontFamily: font, fontWeight: WEIGHT.bold, fontSize: "19px", color: INK }}>{pct(acc.ratio)}</span>}
              />
              <div style={{ ...meta, lineHeight: 1.6 }}>
                <span style={{ fontSize: SIZE.ui, color: INK, fontWeight: WEIGHT.semibold }}>{acc.done} of {acc.total}</span> criteria met<br />
                across {acc.specs} spec{acc.specs === 1 ? "" : "s"} still in flight
              </div>
            </div>
          </Card>

          {/* ---- group 5: momentum ---- */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead note="last 10 weeks">Momentum</CardHead>
            <Bars
              height={104}
              series={[
                { values: mo.signals, color: ACCENT.signal },
                { values: mo.insights, color: ACCENT.insight },
              ]}
            />
            <div style={{ display: "flex", gap: SPACE.lg, marginTop: SPACE.md }}>
              <LegendDot color={ACCENT.signal} label={`Signals · ${mo.signals.reduce((a, b) => a + b, 0)}`} />
              <LegendDot color={ACCENT.insight} label={`Insights · ${mo.insights.reduce((a, b) => a + b, 0)}`} />
            </div>
          </Card>

          {/* open questions */}
          <Tile
            label="Open questions"
            value={oq.open}
            accent={oq.open > 0 ? CITED : ACCENT.action}
            sub={oq.open > 0 ? `unresolved across ${oq.specs} spec${oq.specs === 1 ? "" : "s"}` : "nothing outstanding"}
          />

          {/* initiatives */}
          <Card padded>
            <CardHead>Initiatives</CardHead>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              {iniStatus.map((s) => <LegendRow key={s.key} color={INITIATIVE_COLOR[s.key]} label={s.key} value={s.value} />)}
            </div>
          </Card>

          {/* stale specs */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead>Stale active specs</CardHead>
            {stale.length === 0 ? (
              <div style={{ ...meta, lineHeight: 1.5 }}>Every active spec was touched in the last 3 weeks.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
                {stale.slice(0, 5).map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.base, fontFamily: font, fontSize: SIZE.sm }}>
                    <span style={{ color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "Untitled spec"}</span>
                    <span style={{ ...meta, flexShrink: 0 }}>{relativeTime(s.updatedAt, now)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* recently touched */}
          <Card padded style={{ gridColumn: "span 2" }}>
            <CardHead>Recently touched</CardHead>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              {recent.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: SPACE.sm, fontFamily: font, fontSize: SIZE.sm }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: KIND_COLOR[r.kind] || INK_FAINT, flexShrink: 0 }} />
                  <span style={{ color: INK, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ ...meta, flexShrink: 0 }}>{relativeTime(r.updatedAt, now)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.md, color: INK }}>{value}</div>
      <div style={{ ...meta, marginTop: "2px" }}>{label}</div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.sm, ...meta }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: color }} /> {label}
    </span>
  );
}
