# DEVLOG: behere

<!-- The hub's prefix+a preview reads this file. Keep it current:
     Status = where we are / what's next (one line each).
     TODO   = check off [x] as you go; add new items on top.
     Log    = newest dated entry on top, one per work session. -->

## Status
Now:  M1 LIVE — behere_bell container running, first scheduled bell tonight 20:16; soak for a day
Next: confirm a day of real bells, then M2 (real line pool) / M3 (visual renderer)

## TODO
- [x] M0 — push feasibility spike on the S24 (see plan for Samsung gotchas)
- [x] M1 — buzz + line bells end-to-end (bell-server container + scheduler) — built, soaking
- [ ] M1 soak — a full day of real bells lands correctly
- [ ] M2 — line pool (dedicated writing session)
- [ ] M3 — ephemeral visual
- [ ] M4 — landing/install page
- [ ] flesh out CLAUDE.md — what this is, stack, structure
- [x] write the founding PRD (docs/PRD_<Name>_<Month><Year>.md)

## Log
### 2026-07-20 — port move + right bot
- 9443 collided with Portainer → moved to 8444 (verified free first);
  new origin https://alipc-1.tailb5ecd6.ts.net:8444, PWA reinstalled.
- Dead-man ping moved off the antigravity bot onto alidevhub_bot
  (token source: ~/.hub/telegram.env); re-verified live.
- General port-conflict rule + check one-liner added to devroot README.

### 2026-07-20 — M1 built and live
- Real bell-server: schedule.js (exponential gaps in waking-window time,
  90-min floor, sim-verified ~3.9/day, 0 out-of-window in 120 draws),
  lines.js (12 original starter lines), telegram.js dead-man ping
  (tested live via the telegram-mobile-command bot; secrets in .env,
  gitignored), restart-safe state.json, /health endpoint.
- Dockerized: behere_bell via compose at repo root, TZ America/LA,
  window 07:00–23:00, data volume; picked up the M0 subscription.
  First scheduled bell: tonight 20:16.
- Quirk: Portainer also owns 0.0.0.0:9443 — phone traffic via tailnet is
  intercepted by tailscaled (correct app), but local requests to the
  tailscale IP:9443 hit Portainer. Cosmetic; don't change the port
  (it's the PWA origin).

### 2026-07-20 — M0 spike passed
- Built minimal PWA (app/) + spike server (server/: static + /vapid +
  /subscribe + send.js), served at https://alipc-1.tailb5ecd6.ts.net:9443
  via `tailscale serve --https=9443 http://localhost:8090`.
- Verified end-to-end on the S24: install as WebAPK, subscribe, push with
  app fully closed, buzz + line on lock screen, visual-bell tap opens app.
- Debugging trail: silent notifications were (a) a real bug — same-tag
  notifications need `renotify: true` or Android silences them — and
  (b) notification volume slider at zero. Samsung hides per-category
  (Alert/Silent) settings behind Notifications → Advanced → "Manage
  notification categories". All captured in the plan for M4's docs.

### 2026-07-20 — PRD review + implementation plan
- Reviewed founding PRD; found two load-bearing gaps: PWAs can't self-schedule
  notifications (a server is mandatory), and iOS has no Vibration API (so
  "pure haptic" = content-free notification buzz).
- Decisions: Android (S24) first; scheduler as a docker container on the
  homelab (Cloudflare Worker as escape hatch); HTTPS via Tailscale Serve;
  offline-first PWA; ~4 bells/day Poisson with 90-min gap; 10-min push TTL;
  tap-gated 60s-fresh visual; server-side line pool; telegram-bridge dead-man.
- Wrote docs/PLAN_Implementation_July2026.md; added M0 spike milestone.

### 2026-07-20 — project created
- scaffolded from _starter: CLAUDE.md + DEVLOG.md + docs/ (PRD template)
