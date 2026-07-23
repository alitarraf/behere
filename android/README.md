# BeHereNow — Android shell (sideloaded, no Play Store)

A ~1-Activity native app that turns the bell into an **alarm-style full-screen
takeover** on the phone: no tap needed. See the design in
[`../docs/PRD_BeHereNow_FullScreenBell_July2026.md`](../docs/PRD_BeHereNow_FullScreenBell_July2026.md).

## How it works (transport = local exact alarm, zero Google)

- The bell-server keeps owning the schedule and publishes a **buffer of ~2 days of
  bells** — a list of `{ts, mode, text}` — at `GET /next` (each chosen at schedule
  time, not fire time; decided times never move, only new far-future ones append).
- This app **polls `/next`** (WorkManager, every ~15 min + on open + after each
  fire) and arms a **doze-exempt exact alarm** (`AlarmManager.setAlarmClock`) for
  **every** bell in the buffer. So the phone can be **off Tailscale / offline for up
  to ~2 days and still fire every bell** — the alarms are all local. No push, ever.
  (Tune the window with `BUFFER_DAYS` on the server.)
- At `ts`, `BellAlarmReceiver` raises a **full-screen-intent** notification that
  launches `MainActivity` over the lock screen. A `WebView` loads the existing web
  UI (`/?bell=ts&mode=…&t=…`) — the same visual/line/buzz manifestations — then the
  activity steps away after ~14 s. Ephemeral as ever.

No FCM, no Firebase, no account. The phone talks only to the tailnet server.

## Build

Needs a JDK 17 + the Android SDK (platform 34, build-tools 34).

```bash
cd android
# point at your SDK if not already:
echo "sdk.dir=/home/ali/android-sdk" > local.properties
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Override the server URL at build time if the tailnet name changes:

```bash
./gradlew assembleDebug -PbellBaseUrl=https://your-host.ts.net:8444
```

> Note: this environment needed `org.gradle.caching=false` (set in
> `gradle.properties`) — the sandbox OOMs while packing the build cache. On a
> normal machine you can re-enable caching.

## Install on the S24 (no Play Store)

**Over USB (adb):**
```bash
/home/ali/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Or by file:** copy the APK to the phone, tap it, allow "install unknown apps".

## First run — three one-time grants

Open the app once. It requests notifications (dialog) and shows a button for each
missing permission — tap through them:

1. **Allow exact alarms** — so the bell can fire from deep sleep.
2. **Allow full-screen bell** — Android 14 gates `USE_FULL_SCREEN_INTENT` for
   non-alarm apps; this is the screen-takeover grant.
3. **Keep running in the background** — battery-optimization exemption, so the
   poll and alarm survive Samsung's app-killing.

When all three are green the home screen just shows the next bell's time. Then
leave it — the phone will light up on its own.

## Verify (N0 gate)

The build is confirmed; the **on-device full-screen takeover from a locked, screen-
off S24 is the thing to confirm in the flesh** (the PRD's N0).

**Fast path (60 s, no server, no waiting):** open the app — the debug build shows a
**"Test bell in 60s (visual)"** button. Tap it, lock the phone, put the screen to
sleep. In a minute the screen should light up on its own into the flow-field visual.
This arms a local alarm directly, so it exercises the exact receiver → full-screen
intent → WebView path a real bell uses, without the server round-trip or the 15-min
poll — and without the PWA double-firing.

If it lights up: N0 is passed. If it stays dark, the culprit is one of the three
grants (most likely **full-screen bell** or **battery optimization**) — re-open and
check they're all green.

Offline note: if the phone is off-tailnet when a bell fires, the takeover still
happens and shows a local fallback (the line, or a breathing dot) instead of a blank
error — but the live procedural visual needs the tailnet. Full offline parity
(bundling `app/` into the APK) is a later step (PRD N3).
