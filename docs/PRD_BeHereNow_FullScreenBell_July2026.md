# PRD: BeHereNow — Full-Screen Bell (sideloaded native shell)

**Status:** Draft · **Date:** 2026-07-23 · **Owner:** Ali
**Supersedes nothing.** Extends the founding PRD (`PRD_BeHereNow_July2026.md`,
which shipped the bell as a PWA) and is orthogonal to the public/friends PRD
(`PRD_BeHereNow_Public_July2026.md`). This is a personal-device delivery upgrade,
not a product pivot.

## Problem

The bell is meant to be Linji's stick — an interruption you *cannot* ignore into
presence. But as a PWA, the bell is a notification you have to **tap** before
anything happens. The web platform makes that a hard floor:

- A service-worker `push` handler can only `showNotification()`. It **cannot**
  open a window or take over the screen without a user gesture — `clients.openWindow`
  is only permitted inside `notificationclick`.
- The web has **no equivalent of Android's full-screen intent** — the native
  mechanism alarms and calls use to light up the locked screen unprompted.

So the current bell is a polite tap-to-open. The philosophy wants a takeover: the
phone stops you, you don't decide to be stopped.

## Goal

On Ali's Galaxy S24, when a bell fires, the screen **turns itself on and shows the
manifestation full-screen** — no tap — exactly like an alarm going off. The fire-time
trigger is a **local exact alarm on the phone** (`AlarmManager.setAlarmClock`, the
doze-proof primitive every alarm clock uses); the server owns the schedule and hands
it to the phone ahead of time. Delivered by a tiny **sideloaded** Android app. **No
Play Store, ever.**

## Non-goals

- **No Play Store listing** — build the APK locally, install by `adb install` or
  tap-to-install ("install unknown apps" allowed once). Distribution stays personal.
- Not a rewrite. The entire visual/line/haptic UI stays in the existing `app/`
  web code, shown inside a WebView. No native UI beyond the shell.
- No accounts, no analytics, no new user-facing surface. Same solo tool.
- Not the public version. This app is for Ali's phone only; friends-scaling is a
  separate track and may or may not adopt this shell later.

## Why the trigger is local, not a real-time push

A bell is a **scheduled time event**, so the right fire-time mechanism is the one
alarm clocks use: a **local exact alarm** that is exempt from doze and fires whether
or not anything can reach the phone at that instant. The server never has to "punch a
push through Samsung's doze at the exact moment" — that real-time-delivery risk (the
M0 pain) is designed out entirely.

The server keeps owning the schedule; it just tells the phone **the next bell ahead
of time** — a sync whose delivery timing doesn't matter because it arrives well
before the fire time. That sync can be a non-time-critical **FCM data message** or
even a plain **tailnet poll** of the `nextFireAt` the server already exposes on
`/health`. Either way there is **no Google in the fire-time critical path**, which is
both more reliable and more in keeping with the ethos. (Web push on Android Chrome
already rode Google's FCM rails invisibly, so even the sync-over-FCM option is not a
new dependency — but with a local alarm we're free to drop it for a poll if we want.)

## Approach

A ~1-Activity Android app + a small server-side FCM send path. Four moving parts:

**1. Native shell (new, tiny)**
- `MainActivity` — a full-screen `WebView` pointed at the existing app over the
  tailnet (`https://alipc-1.tailb5ecd6.ts.net:8444`), with query params carrying the
  manifestation (`/?bell=<ts>&mode=<mode>&t=<urlenc text>`). Shown over the lock
  screen (`setShowWhenLocked` / `setTurnScreenOn`).
- `BellAlarmReceiver extends BroadcastReceiver` — **the fire-time trigger.** When the
  local exact alarm goes off, it builds a high-importance notification with
  **`setFullScreenIntent(pendingIntent, true)`** targeting `MainActivity`, plus the
  existing vibration pattern. Screen off/locked → Android launches the Activity
  full-screen; in-use → heads-up (same graceful degradation alarms have). **No network
  needed at fire time** — the payload was delivered ahead of time.
- Schedule sync — a small component that receives the **next** bell
  (`{ts, mode, text}`) from the server *ahead of time* and calls
  `AlarmManager.setAlarmClock(ts, …)`. Transport is either a non-time-critical FCM
  data message (`BellMessagingService extends FirebaseMessagingService`) **or** a
  plain periodic tailnet poll of `/next` (decide in N1; poll = zero Google). After an
  alarm fires, the phone re-syncs to stay exactly one bell ahead.
- On first run: request `POST_NOTIFICATIONS` (Android 13+); ensure exact-alarm
  permission (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`, deep-link to
  `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` if needed); check
  `NotificationManager.canUseFullScreenIntent()` and, if false (Android 14 default for
  non-alarm apps), deep-link to `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`; prompt for
  battery-optimization exemption. All one-time toggles.
- Identity: whatever sync transport is chosen, the phone registers itself with the
  server once (FCM token, or just "I'm here, poll-based") — replacing the web-push
  subscription as the phone's identity.

**2. Manifestation rendering (small `app/` addition)**
- Today `?bell=<ts>` already renders the ephemeral **visual** (`app/visual.js`).
  Extend the entry so the page can also render a **line** full-screen (mode=line)
  and a bare **buzz** ack (mode=buzz), driven purely by query params — so the
  WebView shows the manifestation itself, not just a notification body.
- Keep it ephemeral: URL scrubbed after render, nothing stored (unchanged behavior).

**3. Server: publish the *next* bell instead of pushing at fire time**
- The mode/text/ts decision moves from **fire time** to **schedule time**: when the
  server reschedules, it also picks `mode` (via `pickMode`) and `text` (`pickLine` /
  `distill`) for the upcoming bell, and stamps `ts` = the scheduled fire time. The
  visual seed is unchanged in spirit — still "seeded by that exact moment," where the
  moment is now the scheduled instant.
- New endpoint **`GET /next`** returning `{ts, mode, text}` for the upcoming bell —
  the phone polls this (and re-polls after each fire) to stay one bell ahead. This is
  the zero-Google path and reuses the exact state the server already keeps.
- Optional **FCM sync push**: `firebase-admin` (or raw HTTP v1) + a git-ignored
  service-account JSON in `server/data/`, sending a **data-only** message with
  `android: { priority: 'normal' }` whenever the next bell changes — a *nudge* to
  re-sync, never the fire-time trigger, so its delivery timing is not critical. Decide
  poll-only vs. poll+push in N1.
- New endpoint **`POST /register`** storing the phone's identity
  (`data/device.json`), replacing `/subscribe` → `subscription.json`. **During the
  soak, keep the web-push path alive** in parallel so nothing is lost while the native
  shell is validated; retire it once trusted.
- Reuse everything else unchanged: scheduling math (`schedule.js`), line pool
  (`lines.js`), seed/distill (`seed.js`), Telegram death-pings (`telegram.js`),
  `state.json`, `/health`. The server no longer needs a fire-time push, but keeps its
  own clock so it can detect a phone that has gone silent (missed re-sync) and ping
  Telegram — the same liveness role it plays today.

**4. Build & install (no store)**
- Generate the project with **Bubblewrap** (TWA scaffold, then graft the
  `FirebaseMessagingService` + full-screen `MainActivity`) *or* a bare Android Studio
  project — decide in M1. Either yields a signed APK.
- Install: `adb install app-release.apk` over USB, or push the APK to the phone and
  tap it. Self-signed debug/release key is fine — no Play signing.

## Architecture (one bell, end to end)

```
server reschedules  →  picks {ts, mode, text} for the NEXT bell, stores in state
   (schedule.js, unchanged math)          │
                                          │  ahead of time, timing NOT critical:
                                          ▼
                 phone syncs via  GET /next   (poll)   or   FCM nudge → re-poll
                                          ▼
                 AlarmManager.setAlarmClock(ts, BellAlarmReceiver)   [doze-exempt]
                                          ▼
                 ── at ts, fully local, no network ──
                                          ▼
                 BellAlarmReceiver → Notification + setFullScreenIntent(Main, true)
                                          ▼
        screen turns on → MainActivity → WebView /?bell=ts&mode=…&t=…
                                          ▼
                 existing app/ renders visual / line / buzz, ephemeral
                                          ▼
                 phone re-syncs GET /next → sets the following alarm (one ahead)
```

## Milestones

- **N0 — local full-screen alarm spike on the S24** *(the core risk, much smaller
  now)*. Minimal APK: a hardcoded exact alarm a few minutes out fires a
  `setFullScreenIntent`; confirm the **locked, screen-off S24 lights up full-screen
  with no tap**. Validate the Android-14 `USE_FULL_SCREEN_INTENT` + `SCHEDULE_EXACT_
  ALARM` grant flows and battery-opt exemption. Test with the app swiped from recents
  (Samsung's aggressive kill) — an exact alarm should still fire; if it doesn't,
  that's the one thing to solve here. *No push involved, so no doze-delivery gamble.*
- **N1 — server `/next` + `/register`, phone sync + alarm scheduling.** Move
  mode/text/ts selection to schedule time; add `/next` and `/register`; phone polls
  `/next`, sets `setAlarmClock`, re-syncs after each fire. Decide poll-only vs.
  poll+FCM-nudge. Keep web-push alive in parallel. Verify a real server-scheduled
  bell fires full-screen on the phone end to end.
- **N2 — WebView shell + manifestation routing**. Full-screen `MainActivity` over the
  lock screen, query-param rendering for visual/line/buzz in `app/`, ephemeral scrub
  preserved.
- **N3 — hardening**. `BOOT_COMPLETED` re-arm of the pending alarm, re-sync on
  connectivity regain, offline (tailnet unreachable) WebView fallback to a bundled/
  precached shell, vibration parity, clock-change/DST resilience.
- **N4 — sideload + soak**. Signed APK, documented install steps in DEVLOG, run it as
  the primary bell for the existing soak window; retire web-push if trusted.

## Risks & open questions

- **Exact-alarm firing on a killed app (Samsung).** `setAlarmClock` is the strongest,
  doze-exempt alarm class and survives app-swipe, but Samsung is aggressive — N0 must
  confirm it fires after the app is removed from recents. Battery-opt exemption is
  mandatory. This is a *much* smaller risk than pushing through doze in real time.
- **Staying one bell ahead.** If the phone misses a re-sync (offline at fire time,
  reboot), it could lack the *next* alarm. Mitigate: re-sync on connectivity regain
  and on `BOOT_COMPLETED`; the server's own clock detects a silent phone and pings
  Telegram (its existing liveness role). Worst case a bell is skipped, never wrong.
- **Android 14 grants (two of them now).** `USE_FULL_SCREEN_INTENT` and exact-alarm
  are off/gated by default for non-alarm apps — fine for one personal device (toggle
  once each), but required manual grants; document them so a reinstall doesn't
  silently downgrade.
- **FCM only if we keep the nudge.** Poll-only `/next` means *zero* Google and no
  service-account credential at all. If we add the FCM nudge for snappier re-sync,
  keep the service-account JSON git-ignored in `data/` beside `vapid.json`; never
  commit. Lean poll-only unless polling proves too laggy.
- **Tailnet reachability from the WebView.** The phone must be on the tailnet for the
  WebView to load live UI. The SW precache already gives an offline shell; confirm the
  WebView benefits or bundle a minimal local copy for the visual.
- **Long line text over URL.** Paraphrase lines are short; URL-encode in the query
  param. If ever too long, fetch by `ts` from the server instead.
- **Open:** Bubblewrap-TWA-plus-native vs. a bare Android Studio project — decide in
  N1 by whichever makes the alarm receiver + full-screen Activity least awkward.
  Bubblewrap buys the WebView-over-tailnet wiring for free but fights you on custom
  native receivers; a bare project is likely cleaner here since the app is mostly a
  receiver + one Activity.

## Definition of done

A bell fires on the server's own schedule; Ali's locked S24, screen off, lights up
full-screen with the manifestation and the buzz, **no tap** — installed from a local
APK, no Play Store involved, no change to the bell's timing, philosophy, or
statelessness.
