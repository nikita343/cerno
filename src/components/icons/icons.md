# Icons

One local inline-SVG set. Replaces both icon sources in the design bundle: the
Iconify `line-md` web component (which loaded from a CDN at runtime) and the
hand-written inline SVGs.

## Why local

No network request, no CDN dependency, nothing to fail offline, and it keeps
the bundle self-contained. Cost: the `line-md` draw-on-mount animations are not
reproduced.

## Conventions

- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`
- `strokeWidth` 1.6–1.9, round caps and joins — matches the brief
- `aria-hidden="true"` and `focusable="false"` on every icon; the *button*
  carries the accessible name, not the glyph

## Sizing

`size` defaults to `1em`, so an icon scales with its container's font size —
which keeps it correct under the fluid rem ladder. Pass an explicit rem value
where the design specifies one.

```tsx
<SearchIcon size="1.1875rem" />   // 19px in the design
<CheckIcon />                      // inherits container font-size
```

## Adding one

Match the conventions above and export from `index.tsx`. Don't add a
`fill`-based icon — the set is stroke-only and themes swap `currentColor`.
