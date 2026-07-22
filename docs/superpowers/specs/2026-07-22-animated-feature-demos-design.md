# Animated feature demos on the landing page

## Problem

The landing page's features section ([src/app/page.tsx:409-433](../../../src/app/page.tsx#L409-L433)) renders each of the 7 features with a static screenshot (`next/image` from `src/assets/*.png`). The old landing (`cerno-old/Landing.dc.html`) had 6 bespoke, self-running animated demo panels in this exact slot instead — a typewriter brain-dump popping structured tasks, a capacity bar overflowing into a "parked" state, an inbox reasoning typer, a label-highlight + segmented filter control, a self-completing reminders list, and an `@mention`-to-avatar team assign. These read as much more alive than static screenshots and better demonstrate what Cerno actually does.

The current page has a 7th feature, "Drag & drop," that didn't exist in the old landing and has no matching demo.

## Goal

Replace all 7 static feature images with animated demo panels:
- Port the 6 existing demos (capture, plan, inbox, labels, reminders, teams) from `cerno-old`.
- Author 1 new demo for "Drag & drop" in the same visual/motion language.
- Keep the existing CSS Modules convention (no inline styles, no Chakra).
- Reuse the existing GSAP motion layer in `LandingMotion.tsx` rather than introducing a second animation system.

## Non-goals

- No changes to feature copy (`FEATURES` array text stays as-is except the `image`/`alt` fields).
- No changes to the "watch it think" bento section (already animated, untouched).
- No changes to `HeroSpline` or other sections.
- Not building a generic/reusable "demo panel" abstraction beyond what's needed for these 7 variants — each panel is bespoke, matching the old file's approach.

## Architecture

### 1. Markup — `src/components/landing/FeatureDemo.tsx` (new)

A server component (no hooks, no `"use client"`) exporting:

```ts
export type DemoVariant = "capture" | "plan" | "inbox" | "drag" | "labels" | "reminders" | "teams";
export function FeatureDemo({ variant }: { variant: DemoVariant }): JSX.Element
```

Internally a switch over 7 sub-components (`CaptureDemo`, `PlanDemo`, `InboxDemo`, `DragDemo`, `LabelsDemo`, `RemindersDemo`, `TeamsDemo`), each returning the panel markup carrying the `data-f{n}-*` hooks GSAP will target, styled with `landing.module.css` classes instead of inline styles. Each panel keeps the same shell: bordered, rounded, soft-shadowed card (`.demoPanel`) matching the old `data-demo="f1"`..`"f6"` container style, min-height ~360px.

Kept in its own file (not inlined in `page.tsx`) to keep `page.tsx` focused on page structure and content, matching the existing split where `HeroSpline` and `LandingMotion` are already separate components.

### 2. Data — `src/app/page.tsx`

- `Feature` interface: drop `image: StaticImageData` and `alt: string`, add `demo: DemoVariant`.
- `FEATURES` array: each entry gets a `demo` value instead of `image`/`alt` (capture→"capture", the plan→"plan", inbox→"inbox", drag & drop→"drag", labels & filters→"labels", reminders→"reminders", teams→"teams").
- Remove the image imports that become unused: `addTaskImg`, `inboxImg`, `dragImg`, `filtersImg`, `notificationsImg`, `teamImg`. `upcomingImg` stays — it's used separately in the hero frame ([src/app/page.tsx:248](../../../src/app/page.tsx#L248)), not just in `FEATURES`.
- In the features loop, replace:
  ```tsx
  <div className={styles.shotFrame}>
    <Image src={f.image} alt={f.alt} className={styles.shot} ... />
  </div>
  ```
  with:
  ```tsx
  <FeatureDemo variant={f.demo} />
  ```
  still wrapped in `.featureMedia` with `data-reveal`, so the existing scroll-reveal and scrub-parallax in `LandingMotion.tsx` (which targets `.feature` → last `[data-reveal]` child) continues to work unchanged.

### 3. Motion — `src/components/landing/LandingMotion.tsx`

Add one new block to the existing `useEffect`, after the current "live demo" section, porting `initFeatureDemos` from `cerno-old`. Reuses the file's existing `q`/`one` helpers, `alive`, `timers`, `loops`, `triggers` arrays — no new state machinery. Each of the 7 demos is its own IIFE-per-variant block, matching the old file's structure:

- **F1 capture** — typewriter into `[data-f1-typed]`, then 3 `[data-f1-task]` rows pop in staggered, hold, fade out, loop.
- **F2 plan** — capacity bar (`[data-f2-bar]`) animates width past 100% then eases back, `[data-f2-deferred]` "parked" row fades in/out, loop.
- **F3 inbox** — cycles 3 items' title/label/reasoning, typewriter into `[data-f3-typed]`, `[data-f3-add]` pill pops in, loop.
- **F4 labels** — chips (`[data-f4-chip]`) highlight-cycle one at a time; segmented control underline (`[data-f4-underline]`) slides between `[data-f4-seg]` options, loop.
- **F5 reminders** — top row in `[data-f5-rows]` completes (checkmark, strikethrough), badge count decrements, row cycles to bottom and resets, loop.
- **F6 teams** — typewriter `@mention` into `[data-f6-typed]`, mention chip pops, avatar assigns onto the task row and the seat stack, seat count ticks up, loop.
- **F7 drag (new)** — a task card lifts (scale up + shadow), tweens position from an "afternoon" slot to a "morning" slot in a small day-column mockup, drops (scale back, shadow settles), pauses, reverses, loop. Built from scratch in the same GSAP idiom as the others (timeline with `power2`/`back.out` easing), no new visual system.

**Reduced motion.** The existing `if (reduce) { ... return; }` early-exit block gets extended: fill each demo's typed span with its final text, and force-show each demo's "result" elements (`data-f1-task`, `data-f2-deferred`, `data-f3-add`, `data-f6-avatar`, and the drag demo's card in its dropped/morning position) via `gsap.set(..., { opacity: 1 })`, exactly like the existing `data-typed`/`data-notif` handling. Every panel reads as a complete, static end-state.

**Safety net.** The existing 2.6s safety timeout (which force-reveals anything still at opacity 0) gets its selector list extended to include the new demos' opacity-0 result elements, matching `cerno-old`'s `_tmr3` guard. A JS failure mid-init leaves full panels visible, never blank ones.

## Styling

All 7 panels' inline styles from `cerno-old` are converted to classes in `landing.module.css`, following the file's existing naming (`camelCase`, scoped under a `demo` prefix e.g. `.demoPanel`, `.demoBar`, `.demoChip`, `.demoRow`, `.demoDayCol` for the new drag layout). Colors reuse the existing hex values (`#C77F17`, `#3B6FD4`, `#7B57E0`, `#1E9E6E`, `#D23E6E`) and `var(--l-accent)` token already used elsewhere on the page — no new palette introduced.

## Testing / verification

No unit tests exist for the landing page today (visual/motion-driven). Verification is manual:
- Run the dev server, scroll through `#features`, confirm each of the 7 panels animates and loops without layout jank.
- Toggle `prefers-reduced-motion: reduce` in devtools, confirm every panel shows a static, complete-looking end state with no motion.
- Throttle/block the LandingMotion chunk (or add a thrown error) to confirm the safety net still reveals full panels rather than leaving them blank — matching the file's existing guarantee.
- Check responsive layout at mobile width (panels currently rely on `.featureMedia`'s existing grid behavior, which flips to stacked via `data-flip`/media query already in `landing.module.css`).

## Open questions

None — scope and approach confirmed with the user before writing this spec.
