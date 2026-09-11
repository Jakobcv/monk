// Two icons cross-fading in place — for a control whose icon changes to confirm what just
// happened (copy → copied). Both icons stay mounted, the incoming one absolutely positioned
// over the one holding the layout, which is what lets *both* directions animate: an icon that
// unmounts can't have an exit. No motion library needed, and none is installed here.
//
// The inactive icon is the one in flow, so it sets the size and no explicit dimensions are
// required. Both draw with currentColor, so the button's own colour transition carries them.
//
// Reduced motion collapses this to an instant swap via the global rule, which is fine: the
// colour and the label change too, so motion was never the only signal that it worked.
export default function SwapIcon({ active, activeIcon: Active, inactiveIcon: Inactive, size = 13 }) {
  return (
    <span className="swap-icon">
      <span className={`swap-icon__over${active ? " is-on" : ""}`} aria-hidden="true">
        <Active size={size} />
      </span>
      <span className={`swap-icon__base${active ? "" : " is-on"}`} aria-hidden="true">
        <Inactive size={size} />
      </span>
    </span>
  );
}
