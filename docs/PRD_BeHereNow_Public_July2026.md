# PRD: BeHereNow — Public (friends) version

**Status:** Planned, gated on soak · **Date:** 2026-07-20 · **Owner:** Ali
**Founding PRD:** [PRD_BeHereNow_July2026.md](./PRD_BeHereNow_July2026.md) —
which deferred exactly this ("revisit only if Ali is still using this
unprompted"). This PRD is the revisit plan, written early so the decision
is deliberate; **building is gated on the soak** (see Milestones).

## Problem

The bell works (M0–M4 shipped 2026-07-20, one user). Friends should be
able to install it from a link — but the current deployment is
single-subscriber by design and lives tailnet-only on the homelab, so it
is structurally unshareable.

## Goal

A public URL any friend can open, read the philosophy, install, tap
"begin" — and from then on receive their own randomly-timed bells in
their own timezone and waking window. Still no accounts, no analytics,
no history. The page can honestly say: this app knows nothing about you.

## Non-goals (unchanged from founding PRD)

- No accounts, emails, or login — the push subscription IS the identity.
- No analytics, tracking, or usage metrics of any kind.
- No history, streaks, or content browsing for anyone.
- No monetization, no app-store listing — PWA via link only.
- No feed, no social features, no seeing other users. Solo bells, many solos.

## Decisions (made 2026-07-20)

1. **Hosting: port to Cloudflare Workers** (not homelab + tunnel).
   Friends' bells must not depend on a Windows PC being awake. Free tier
   covers this scale. The homelab container stays for Ali until cutover,
   then retires.
2. **Domain: TBD** — must be chosen BEFORE the first friend installs
   (the origin is the PWA's identity; changing it means everyone
   reinstalls). Blocking open question.
3. **Timing: soak first.** No building until the soak gate passes.

## Approach

**Worker architecture** (single Worker, static assets + API + scheduler):

- **Static assets**: the existing `app/` served by the Worker (Workers
  static assets). Same origin as the API, as today.
- **Storage**: one Durable Object per subscriber, keyed by a hash of the
  push endpoint. Holds { subscription, window, tz, nextFireAt, failures }.
  DO **alarms** give exact-time fires per subscriber — no cron scanning,
  each subscriber's schedule is independent, same exponential/min-gap
  math as today (schedule.js ports unchanged; it must run in the
  subscriber's IANA timezone, captured from the browser at begin-time).
- **Web push from Workers**: no `web-push` npm (Node-specific); VAPID is
  an ES256 JWT signed via WebCrypto + aes128gcm payload encryption.
  Use a Workers-compatible push library if a maintained one exists,
  else implement (well-documented, ~150 lines). Spike this FIRST — it
  is the only genuinely new technical risk.
- **App changes**: one-time waking-window picker on first run (default
  07:00–23:00), tz capture via Intl; on every open, re-sync the
  subscription to the server (self-healing — no dead-man ping for
  friends, dead subscriptions are pruned on 404/410).
- **Ali's dead-man ping** stays, but moves to: a daily Worker cron that
  Telegrams only if *Ali's own* subscriber record is dead. Friends get
  no monitoring — their recovery path is "open the app again".
- **Abuse surface**: /subscribe rate-limited (Cloudflare built-ins are
  enough), payload size capped, subscriptions validated against real
  push-service origins. Worst case someone subscribes a garbage
  endpoint; it 410s and prunes itself.
- **Line pool & seed distillation** port as-is (pure JS, no Node APIs).

**What deliberately does NOT change:** three manifestations at random,
radical impermanence, the tap-gated 60s-fresh visual, the state-aware
landing page, original lines only.

## Scope / Milestones

- [ ] **P0 — soak gate (now → ~2 weeks):** Ali lives with the bell.
      Gate to proceed: still wanted, unprompted, after the novelty
      fades. If the answer is no, this PRD stays a plan and that is a
      fine outcome.
- [ ] **P1 — Workers push spike:** send one web push (all three
      manifestation payloads) from a Worker to the S24. Proves the
      VAPID/encryption path — the only new risk. Half a day.
- [ ] **P2 — multi-subscriber port:** DO-per-subscriber with alarms,
      schedule.js in per-user tz, window picker + tz capture in the
      app, subscription re-sync on open, prune on 410. Ali migrates
      (reinstall at the new origin) and runs on it for a few days.
- [ ] **P3 — domain + cutover:** pick the domain (blocking question),
      route the Worker, retire the homelab container, update the
      tailscale serve entry + devroot README serve map.
- [ ] **P4 — first friends:** 2–3 invites, at least one iPhone
      (iOS 16.4+) to validate the iOS install flow for real. Fix the
      install page where reality disagrees with it.

## Open questions

- **Domain** — blocking P3. Candidates to decide: subdomain of an
  owned domain vs. a dedicated cheap domain for the bell.
- iOS quirks unknowable until P4's real device (permission flow,
  notification presentation, silent-kill behavior after inactivity).
- Whether friends ever need a way to change their window post-install
  (current answer: reinstall — acceptably rare, maximally simple).
- Whether to publish the GitHub repo link on the page (it is already
  public) or keep the page free of any outbound links at all.

## References

- Founding PRD: [PRD_BeHereNow_July2026.md](./PRD_BeHereNow_July2026.md)
- Implementation record of M0–M4:
  [PLAN_Implementation_July2026.md](./PLAN_Implementation_July2026.md)
- Repo: https://github.com/alitarraf/behere
