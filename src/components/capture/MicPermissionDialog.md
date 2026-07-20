# MicPermissionDialog

Explains why dictation couldn't start. Layered above `CaptureOverlay`
(z-index 60 vs 50) so the dump text stays visible behind it — nothing typed is
lost.

## Props

| Prop | Type | Notes |
|---|---|---|
| `status` | `"denied" \| "no-device" \| "unavailable"` | Drives the copy |
| `onClose` | `() => void` | — |

## Why per-reason copy

A browser will not re-prompt once the user has blocked the mic, so a generic
"couldn't access microphone" is a dead end. Each status gets specific
instructions:

- `denied` — where the padlock setting lives
- `no-device` — nothing is plugged in
- `unavailable` — needs a secure (https) origin

Every variant says typing still works, because it does.
