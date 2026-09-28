## Tasks

- [x] Push ticks and unticks to every open copy of the list
- [x] Keep ticks made offline and send them in order when signal returns
- [~] Strike through a remote tick for five seconds, then move it once the shopper stops scrolling
- [ ] Show a note at the foot of the list when a tick has waited more than a minute to send
- [!] Measure the delay between phones in three real shops

## Approach

Ship the push to staff households behind a flag first, then the struck-through state, then everyone. The measuring task is blocked on getting two test phones onto a shop's own signal rather than wifi; until then the two-second target is an assumption, and the open question on this spec says so.
