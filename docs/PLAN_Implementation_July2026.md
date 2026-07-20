# Implementation Plan: BeHereNow

**Status:** Agreed · **Date:** 2026-07-20 · **Owner:** Ali
**Founding PRD:** [PRD_BeHereNow_July2026.md](./PRD_BeHereNow_July2026.md)

## Decisions (answers to the PRD's open questions + gaps found in review)

1. **Platform:** Android first (Ali's Galaxy S24, already on the tailnet).
   iOS later — plan keeps it possible (see iOS notes below).
2. **A server is required and accepted.** A PWA cannot schedule its own
   future notifications (Notification Triggers API was abandoned; a service
   worker only wakes when a push *arrives*). The scheduler runs on the
   always-on homelab docker host, joining the existing fleet on the D drive.
   This does not violate "no accounts" — it's one machine, one subscription,
   zero login. Fallback if homelab uptime proves unreliable: port the
   scheduler to a Cloudflare Worker (the code is small enough to move).
3. **HTTPS origin via Tailscale Serve** (`*.ts.net` — real Let's Encrypt
   certs), so the PWA installs and the service worker registers without any
   public exposure. The app is **offline-first** (precached shell), so once
   installed it works even when the phone is off the tailnet — pushes
   arrive via FCM regardless; the tailnet is only needed for install and
   occasional config sync.
4. **Three manifestations, as in the PRD** (buzz-only was briefly cut,
   then restored — its unpredictability is the point: the mind can't
   learn that a bell always brings something to read):
   - **Buzz bell** — content-free notification; the system buzz *is* the
     bell. Nothing to read, nothing to tap.
   - **Line bell** — the line is the notification body; met entirely on
     the lock screen.
   - **Visual bell** — the notification body is a short *distillation* of
     the image about to be generated (e.g. "slow amber field, drifting
     west"), derived from the same seed→parameters mapping the renderer
     uses, so the teaser is honest — it describes the actual image, and
     entices the tap.
   The notification buzz is the haptic layer throughout (portable to iOS,
   which has no Vibration API; Android can add `navigator.vibrate()` when
   the app is open).
5. **Bell frequency:** ~4/day average, random (Poisson-ish draw), minimum
   90-minute gap, only within the waking window. Window is set once in the
   app and POSTed to the server; stored server-side in local time.
6. **Push TTL ≈ 10 minutes.** A bell that can't be delivered promptly
   evaporates — no stale queue dumping on power-on.
7. **The visual is tap-gated and expires.** Manifestation 3's notification
   invites a tap; if opened within ~60s of the push timestamp the canvas
   renders (seeded by that timestamp), otherwise blank. Missed = gone.
8. **Line pool lives server-side**, chosen at send time and delivered in
   the push payload (shown in the notification body — the bell can be met
   entirely on the lock screen). The client never holds the corpus; there
   is nothing to browse.
9. **App opened with no active bell shows nothing** — a blank breathing
   surface. No menu, no content, nothing to check.
10. **Dead-man switch, not in-app status:** push subscriptions rot silently
    (endpoint rotation, reinstalls). On repeated send failures the server
    pings Ali once via the existing `telegram-bridge` container. Purely
    operational; the app itself keeps zero history.

## Architecture

```
[bell-server]  (docker, homelab, always-on)
  - Node 22 + `web-push` (VAPID), single small service
  - state: one JSON file on a volume { subscription, window, nextFireAt }
  - loop: on boot + after each bell, draw nextFireAt (Poisson, min-gap,
    inside window); persisted so restarts don't lose the schedule
  - at fire time: pick manifestation (line vs visual, weighted), pick line
    or derive the visual's distillation from its seed,
    send push { mode, text, ts } with TTL 600
  - on 404/410 or repeated failure: telegram-bridge ping, once
  - endpoints (tailnet-only): POST /subscribe, POST /config, GET /health

[behere PWA]   (static files, served by bell-server, HTTPS via Tailscale Serve)
  - manifest + service worker, offline-first precache of the whole shell
  - SW push handler → showNotification:
      buzz bell:   empty body — buzz only
      line bell:   line as the notification body
      visual bell: seed-derived distillation as the body → tap opens app
  - app on open: if launched from a visual-bell tap and now - ts < 60s →
    full-screen canvas 2D render seeded from ts, ~10s, fade to blank,
    no cache entry, no share/save affordance; otherwise blank surface
  - first-run only: install hint + notification permission + window picker
```

## Milestones (re-scoped from PRD)

- [x] **M0 — feasibility spike — DONE 2026-07-20.** Verified on the S24:
      install (WebAPK — appears as its own app), permission grant, push
      delivery with the app fully swiped away, buzz + line display on
      lock screen, visual-bell tap opens the app, buzz-bell tap does
      nothing (by design). Live at
      `https://alipc-1.tailb5ecd6.ts.net:9443` (tailscale serve → :8090).
      **Findings for M4's install instructions (Samsung/One UI):**
      1. `renotify: true` is mandatory alongside `tag:` — same-tag
         replacement notifications are silent on Android otherwise.
      2. Chrome may create the PWA's "General" notification category in
         a demoted state; categories are hidden until Settings →
         Notifications → Advanced → "Manage notification categories for
         each app" is enabled.
      3. Check the *notification volume* slider — separate from ring/media
         volume, and at zero everything above looks broken (it was this).
- [x] **M1 — buzz + line bells end-to-end — BUILT 2026-07-20, soaking.**
      `behere_bell` container (compose at repo root, `restart:
      unless-stopped`, data volume), 30s-check scheduler loop with
      restart-safe `state.json`, exponential gaps (sim-verified: hard
      90-min floor, ~3.9 bells/day, 0/120 fires outside window),
      12-line starter pool, dead-man Telegram ping (tested live — uses
      the telegram-mobile-command bot, secrets in gitignored `.env`).
      Missed-while-down bells evaporate by design. Weights buzz/line
      50/50, visual 0 until M3. Remaining: observe a full day of
      real bells before ticking the soak.
      **Quirk found & fixed:** serve port 9443 collided with Portainer's
      published 0.0.0.0:9443 (phone traffic worked — tailscaled
      intercepts tailnet traffic before the kernel — but local requests
      hit Portainer). Moved to a verified-free port: the app now lives at
      `https://alipc-1.tailb5ecd6.ts.net:8444` (→ :8090), which required
      one PWA reinstall since the origin changed. General rule added to
      devroot README: check listeners + docker-published ports before
      assigning any port. Dead-man ping switched to the alidevhub bot
      (token from ~/.hub/telegram.env).
- [ ] **M2 — the real line pool:** write ~40–60 fresh lines "in the
      spirit of" Krishnamurti / Tolle / Osho / Ram Dass (a dedicated
      writing session — never verbatim), replacing the starter pool.
- [ ] **M3 — ephemeral visual:** canvas 2D simplex-noise flow field
      (WebGL only if 2D proves insufficient), timestamp-seeded, tap-gated,
      60s freshness window, ~10s life, fade out. Includes the seed→words
      distillation so the notification honestly teases the image.
- [ ] **M4 — landing/install page:** the PWA's own index — philosophy in
      a few lines, install CTA, Android steps now, iOS steps later.

## Risks / iOS notes

- **WSL/host uptime** is the main reliability risk; the dead-man ping is
  the mitigation, Cloudflare Worker port is the escape hatch.
- **Battery optimization** on Android can delay FCM pushes — exempt the
  browser/PWA from battery optimization during M0 testing if needed.
- **iOS later:** requires iOS 16.4+, home-screen install before the
  permission prompt, gesture-gated permission request, no Vibration API
  (manifestation 1 still works as notification buzz). The iPhone would
  need Tailscale for install/config, same as Android.
