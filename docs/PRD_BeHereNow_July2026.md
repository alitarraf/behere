# PRD: BeHereNow

**Status:** Draft · **Date:** 2026-07-20 · **Owner:** Ali

## Problem

Every presence/mindfulness app on the market is future-oriented — streaks,
progress, "10 minutes a day to feel better later." That structure is the
opposite of what it claims to teach: real presence (per Krishnamurti,
Tolle, Osho, Ram Dass) can't be accumulated or tracked, only met, moment by
moment. There's no tool that just interrupts the trance of thought at an
unpredictable moment and asks nothing else of you.

## Goal

A phone that, at random moments during waking hours, makes Ali stop being
anywhere else for a few seconds — with nothing to save, review, track, or
optimize afterward.

## Non-goals

- Not a meditation app — no guided sessions, no technique instruction.
- No accounts, no signup, no other users. Solo, personal tool.
- No history, streaks, logs, or settings dashboard showing "progress."
- No content library to browse — nothing is ever retrievable after it fires.
- No monetization, no app store listing (for now — PWA, sideloaded by Ali).

## Users / Use

One user: Ali. Installs the PWA to his phone home screen once. From then
on, at random points during his own waking-hours window, the phone buzzes.
Sometimes that's all — a pulse and nothing else. Sometimes a short line (in
the spirit of Krishnamurti / Tolle / Osho / Ram Dass, paraphrased, never
verbatim quoted) appears with it. Sometimes a full-screen procedurally
generated visual — seeded by that exact moment — renders for ~10 seconds
and is gone forever, never stored, never replayable. He either meets the
moment or he doesn't; the app makes no record either way.

## Approach

**The Bell**, with three manifestations chosen at random each time it
fires so the mind can't learn to anticipate which is coming:

1. **Pure haptic** — pulse only, nothing to read or look at.
2. **Haptic + one line** — short paraphrase, in the spirit of one of the
   four teachers, never saved or re-shown.
3. **Haptic + ephemeral visual** — procedurally generated (seeded noise
   field / gradient flow via canvas or WebGL, keyed off timestamp and
   possibly device motion/ambient light for extra entropy), full-screen,
   alive ~10 seconds, then gone. No gallery, no share sheet, no replay.

**Core design principle — radical impermanence.** No history, no streaks,
no log of past bells, no account. The app holds no memory of Ali and gives
him nothing to hold onto either. This is the actual product, more than any
one mechanic: a tool that structurally refuses to become an image of
itself, which is Krishnamurti's core diagnosis of how the mind avoids
direct experience in the first place.

**Timing.** Random within Ali's waking hours (window configurable once,
not a daily setting to fiddle with). No hold-back for context (driving,
calls, etc.) — the randomness has to be unconditional or it stops being an
interruption and becomes a scheduled wellness ping.

**Delivery mechanics.** Installed as a PWA (Add to Home Screen), using the
Web Notifications/Push API for the interrupt and the Vibration API for the
haptic pulse. Because iOS/Android PWA notification permissions are fiddly
and easy to silently break, the install flow needs either to handle
permission requests smoothly in one pass, or fall back to very explicit
step-by-step instructions if a platform requires manual settings changes.
A small landing page (personal, not public-facing/marketing) explains the
philosophy in a few lines and has one clear "Install" call to action —
this is Ali's own reference/install point, not a public signup surface.

**Alternatives considered:** guided-technique app (rejected — contradicts
Krishnamurti's "no method" stance); gamified streak tracker (rejected —
recreates future-self thinking, the exact thing this is meant to interrupt);
public multi-user product (deferred — see Non-goals; revisit only if Ali
is still using this unprompted months in).

## Scope / Milestones

- [ ] M1 — Pure-haptic Bell only: PWA installs cleanly, notification
      permission flow works end-to-end, random-interval trigger within a
      configurable waking-hours window, vibration pulse fires reliably.
      No text, no visual yet — prove the interrupt mechanic alone.
- [ ] M2 — Add the text manifestation: small paraphrase pool (written
      fresh, "in the spirit of," not lifted from copyrighted text),
      randomly selected, shown with the pulse, never persisted.
- [ ] M3 — Add the ephemeral visual manifestation: seeded procedural
      renderer (canvas/WebGL noise or particle field), full-screen,
      auto-dismiss after ~10s, no save/share affordance anywhere.
- [ ] M4 — Personal landing/install page: philosophy in brief, one
      install CTA, clear platform-specific instructions for enabling
      notifications if the browser can't prompt cleanly in-flow.

## Open questions

- Exact waking-hours window and how it's set (one-time config vs. simple
  toggle) — TBD at build time.
- Ratio of the three manifestations once all three exist (even thirds vs.
  weighted toward pure haptic) — can be tuned empirically after M2/M3.
- Whether "random, no hold-back" ever needs a manual mute (e.g. Do Not
  Disturb integration) or if that itself is scope creep against the
  design principle.
- iOS PWA notification support has real platform limits (historically
  required home-screen install + specific iOS version) — needs a quick
  feasibility check before M1 is scoped in detail.

## References

- [[BeHereNow-Ideas.md]] — the full spark-mode riff this PRD was
  synthesized from (five initial concepts, the impermanence design
  principle, open questions as they were worked through).
- Inspirations: J. Krishnamurti (choiceless awareness, no-method),
  Eckhart Tolle (*The Power of Now*), Osho (dynamic/active meditation),
  Ram Dass (*Be Here Now*).
