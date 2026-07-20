# SettingsView

`/dashboard/settings`. Reached from the profile menu, not the primary nav —
`SETTINGS_HREF` is deliberately kept out of `NAV_ITEMS` because the tab bar
renders one tab per entry and already carries the five that fit a small phone.

## Sections

| Section | Live? |
|---|---|
| Profile — avatar, display name | **Yes.** Uploads to Supabase Storage; name overrides the auth profile. |
| Reminders — on/off, lead hours | **Yes.** `reminder_lead_hours` drives `lib/reminders.ts`. |
| Language & region | Timezone is stored; **language is stored but not applied** — i18n is later work. |
| Planning model | **Stored but not applied.** The planning routes still use the server default. |

The two "not applied yet" sections say so on screen. A control that silently
does nothing is worse than one that admits it doesn't yet.

## Persistence

Every control writes through `updateSettings`, which is optimistic and rolls
back on failure like the task mutations. There is no Save button: each control
is an independent preference, and a form-wide save implies they commit together.

The display name is the exception — saved **on blur**, not per keystroke, so an
edit is one write rather than one per character.

## Timezone

Defaults to the browser's zone, but **only when the stored value is still
`UTC`** (the schema default, meaning "never chosen"). Overwriting a saved zone
on every mount would make the picker impossible to change from another machine.

The list is a short curated set plus the browser's own zone —
`Intl.supportedValuesOf("timeZone")` returns 400+ entries.

## Avatar

- Bucket `avatars`, public-read, 2 MB cap, image MIME types only.
- Path is `{user_id}/avatar.{ext}` — **the first path segment is what the
  storage policy checks against `auth.uid()`**, so the prefix enforces
  ownership. It is not just tidy naming.
- Size is checked client-side too, so an oversized file fails instantly instead
  of after a doomed upload.
- The returned URL carries `?v={timestamp}`: the object path is stable per user,
  so without it a new upload keeps showing the old image until the CDN entry
  expires.
- Not optimistic — there is nothing to show until the upload completes, and a
  local object URL would be revoked on navigation and leave a broken image.

## Gotchas

- The reminders toggle is a real `<input type="checkbox">` behind a painted
  switch, so keyboard and screen-reader behaviour is native. It carries
  `pointer-events: none`, so a **test must click the `<label>`, not the input**.
- `MODEL_CHOICES` stores a coarse tier (`opus`/`sonnet`/`haiku`), not an API
  model id, so a model refresh doesn't invalidate every stored row.
