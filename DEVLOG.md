# DEVLOG: behere

<!-- The hub's prefix+a preview reads this file. Keep it current:
     Status = where we are / what's next (one line each).
     TODO   = check off [x] as you go; add new items on top.
     Log    = newest dated entry on top, one per work session. -->

## Status
Now:  M0–M4 done; SOAKING (~2 weeks). Public/friends version planned + gated: docs/PRD_BeHereNow_Public_July2026.md
Next: live with the bell. If still wanted after the soak → P1 (Workers web-push spike). Blocking Q for P3: pick a domain.

## TODO
- [x] real screenshots for the breadcrumbs campaign — 4 PNGs in marketing/screenshots/
      (3 landing states + ephemeral visual, captured headless from the live server);
      campaign flipped to `type: static` + glob in breadcrumbs/config/projects.yaml
- [x] M0 — push feasibility spike on the S24 (see plan for Samsung gotchas)
- [x] M1 — buzz + line bells end-to-end (bell-server container + scheduler)
- [x] M2 — 48-line pool (server-side, in-the-spirit-of, original)
- [x] M3 — ephemeral visual + honest seed-derived teaser (verified on S24)
- [x] M4 — state-aware landing/install page (philosophy + Samsung fixes + iOS note)
- [ ] soak — ~2 weeks of real bells (gate for the public version)
- [ ] pick a domain for the public version (blocks P3)
- [ ] after soak: P1–P4 per docs/PRD_BeHereNow_Public_July2026.md
- [ ] someday: tune manifestation weights; flesh out CLAUDE.md
- [x] write the founding PRD (docs/PRD_<Name>_<Month><Year>.md)

## Log
### 2026-07-20 — campaign screenshots captured
- 4 real captures from the live server (headless puppeteer per devroot
  README pattern; localhost:8090 = the same container behind
  https://alipc-1.tailb5ecd6.ts.net:8444): philosophy+install page,
  first-run begin (standalone stubbed), breathing dot (subscription
  stubbed, mid-breath), ephemeral visual mid-render (fresh ?bell= ts).
- Dropped in marketing/screenshots/; breadcrumbs campaign flipped to
  screenshot type: static, glob screenshots/*.png.

### 2026-07-20 — public/friends version planned, gated on soak
- New PRD: docs/PRD_BeHereNow_Public_July2026.md (links back to founding
  PRD, which deferred exactly this). Decisions: port to Cloudflare
  Workers (DO-per-subscriber + alarms; push subscription = identity, no
  accounts/analytics ever); domain TBD (blocks P3, must precede first
  friend install); soak ~2 weeks before building. Only new technical
  risk: web push from Workers (VAPID via WebCrypto) — P1 spikes it.

### 2026-07-20 — M4 shipped: state-aware landing page
- Index now has three states: unsubscribed browser → philosophy +
  install steps (Samsung silent-bell fixes, iOS-later note); installed
  first-run → philosophy + begin; subscribed → breathing dot only.
- Added the Linji/Huangbo three-blows story (Record of Linji) as the
  founding parable — the bell as the master's stick: presence cannot be
  explained, only interrupted into. SW cache v4.
- All PRD milestones (M0–M4) complete in one day. Remaining: soak.

### 2026-07-20 — M2 + M3 shipped
- M2: 48 original lines (12 per teacher-spirit), server-side pool.
- M3: app/seed.js shared seed→params→words module (server + browser use
  the same code, so the teaser always matches the render); app/visual.js
  canvas flow field, ~10s life, tap-gated, 60s freshness, URL scrubbed;
  SW behere-v2 offline-first precache. Weights now even thirds.
- Verified live: "restless rose field, drifting south" teaser → matching
  rose field render on the S24, faded out, gone.

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
