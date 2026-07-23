# DEVLOG: behere

<!-- The hub's prefix+a preview reads this file. Keep it current:
     Status = where we are / what's next (one line each).
     TODO   = check off [x] as you go; add new items on top.
     Log    = newest dated entry on top, one per work session. -->

## Status
Now:  Native full-screen bell WORKS on the S24 (verified 2026-07-23). Locked/screen-off →
      full takeover + local visual; in-use → graceful heads-up. Real server bell armed via
      tailnet /next poll. Plan: docs/PRD_BeHereNow_FullScreenBell_July2026.md
Next: decide PWA retirement (avoid dual-fire during soak); then N3 hardening. Consider making
      this the primary bell and dropping web-push.

## TODO
- [x] N0 — VERIFIED on S24: dozing phone woke itself → full-screen takeover, no tap; visual
      renders from bundled assets (no network at fire time); in-call degrades to heads-up
- [ ] retire/park the PWA so 12:43-style bells don't fire twice (web-push + native)
- [x] N1 (server) — mode/text/ts chosen at schedule time; GET /next + POST /register (live on :8090)
- [x] N2 (app/) — bell view renders visual/line/buzz full-screen from ?mode= params (SW → v5)
- [x] Android app — WebView shell + BellAlarmReceiver(full-screen intent) + SyncWorker(poll /next)
      + BootReceiver; builds to app/build/outputs/apk/debug/app-debug.apk (2.5 MB)
- [x] bundled app/ into the APK (WebViewAssetLoader) — visual renders locally, zero
      network dependency at fire time (closes advisor gap #3)
- [ ] N3 — hardening (boot re-arm verified, DST/clock-change, token-refresh)
- [ ] N4 — signed APK + run as primary bell through the soak; retire web-push if trusted
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
### 2026-07-23 — native full-screen bell: built end-to-end (sideloaded, no Play Store)
- Q from Ali: can a notification go full-screen without a tap? PWA can't (SW push
  can't open a window without a gesture; no web equiv of full-screen intent). Answer =
  a sideloaded native APK, no Play Store needed.
- Architecture decision (advisor-surfaced): the fire-time trigger is a LOCAL exact
  alarm (`setAlarmClock`, doze-exempt), NOT a real-time push. Server publishes the
  next bell ahead of time; phone fires it itself. Kills the deep-sleep/Samsung-kill
  delivery risk and means zero Google at fire time. Transport chosen: poll `/next`
  (no FCM). PRD: docs/PRD_BeHereNow_FullScreenBell_July2026.md.
- Server (live on :8090): mode/text/ts now chosen at schedule time (reschedule),
  stored in state.next; web-push fireBell reuses those so PWA + native agree. Added
  GET /next ({ts,mode,text}) and POST /register (writes device.json, liveness).
  Verified against the running container.
- app/: index.html now renders visual/line/buzz full-screen from ?bell&mode&t,
  bypassing the PWA state machine when mode is present. Headless-verified all three
  render on-brand. SW cache → behere-v5.
- Android app (android/): ComponentActivity WebView shell over the lock screen +
  BellAlarmReceiver (full-screen intent + vibrate) + SyncWorker (WorkManager poll +
  register) + BootReceiver. Poll-only, no Firebase. AGP 8.5.2 / Kotlin 1.9.24 /
  compileSdk 34 / minSdk 26. Built app-debug.apk (2.5 MB); manifest perms +
  BELL_BASE_URL confirmed. Had to set org.gradle.caching=false (sandbox OOMs packing
  the cache). Build/install steps in android/README.md.
- VERIFIED on the S24 same session (wireless adb): installed the APK, granted the 3
  perms via adb (appops USE_FULL_SCREEN_INTENT, exact-alarm, deviceidle whitelist).
  Debug "Test bell in 60s" button → dozing phone woke itself to Awake and took over the
  full screen, no tap (logcat "bell fired: visual", RTC_WAKEUP was "next wake from idle").
  In-call, it correctly degraded to a heads-up banner instead of hijacking the call.
- Found + fixed advisor gap #3 on the spot: phone couldn't resolve the tailnet host at
  fire time → visual fell back to a dot. Fixed by BUNDLING app/ into the APK and serving
  via WebViewAssetLoader → the flow-field visual now renders locally, 712KB frame proven.
- Then Ali turned Tailscale on: phone resolves alipc-1...ts.net (100.70.241.53, 14ms),
  sync succeeded, real server bell armed as RTC_WAKEUP for 12:43 today. Full loop live.
- Open: dual-fire while the PWA is still subscribed (web-push + native both fire).

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
