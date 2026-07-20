# CaptureOverlay

The brain dump. The core action of the product: type or speak everything on
your mind, and Cerno rebuilds the day around it.

## Presentation

- **Desktop** — centred 33.75rem card over a dimmed app.
- **≤767px** — bottom sheet with a heavier scrim, `cernoSheetUp` entrance.

## The three modes (`captureMode` in the store)

| Mode | What's on screen |
|---|---|
| `ready` | Textarea + mic + Cancel + "Plan it" |
| `listening` | Mic filled red, 5 animated bars (`cernoBar`) + "Listening…" |
| `thinking` | Inset row with 3 sequenced dots (`cernoDot`) + planning copy; button reads "Planning…" and is disabled |

## Microphone

Click to start, click again to stop — the browser's own end-of-speech timeout
does **not** end the session (`startDictation` transparently restarts on an
unrequested `onend`).

Availability is confirmed by `ensureMicAccess()` *before* entering `listening`,
so the UI never claims to be recording when it isn't. A blocked or missing mic
opens `MicPermissionDialog` instead of failing silently. Where
`SpeechRecognition` is absent entirely the mic button is not rendered at all.

## Keyboard

- `Escape` — cancel (ignored while thinking)
- `Cmd/Ctrl + Enter` — submit

## Gotchas

- Empty/junk dumps are rejected client-side in `submitDump` — no API call.
- The mic is released on close and on unmount; check `stopListening` before
  adding any early return.
- `MicPermissionDialog` captures `Escape` on the capture phase so it doesn't
  also close the dump behind it.

## Open/close animation

The overlay renders on `captureOpen`, so closing it used to unmount on the same
frame — the entrance animated and the exit was a hard cut. That asymmetry is
what makes a panel feel abrupt no matter how long its open animation is.

`usePresence(open, 180)` (`src/lib/usePresence.ts`) keeps the card mounted for
180ms after `open` flips false and sets `data-leaving`, which swaps in the exit
keyframes. Exits are deliberately faster than entrances — a dismissal should get
out of the way.

The card scales as well as rises on entry (`cernoCardIn`). A 12px translate
alone is too subtle to register on a card this size; it just appears. The mobile
bottom sheet slides instead of scaling, so it reads as coming from the edge of
the screen rather than growing out of the middle.

**`CAPTURE_EXIT_MS` in the .tsx must match the exit duration in the .css.** Too
short truncates the animation; too long leaves an invisible element mounted.
