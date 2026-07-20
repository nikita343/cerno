# Cerno

An AI daily planner. You dump everything on your mind; Cerno parses it into
tasks, estimates effort, weighs priority and deadlines, and builds a realistic
day — scheduling what fits and parking the rest with a one-line reason.

```bash
npm install
cp .env.example .env.local   # optional — see "Running without a key"
npm run dev
```

## Stack

Next.js 15 (App Router) · TypeScript · Zustand · CSS Modules · Anthropic SDK.

Two deliberate deviations from `Cerno — Daily Planner Brief/DEVELOPMENT.md`:

- **CSS Modules, not Chakra UI.** The design is bespoke — flat surfaces,
  hairline borders, no component-library patterns — and the brief's fluid rem
  ladder fights a theme system.
- **No device frames.** The `.dc.html` phone and desktop shells (including the
  9:41 status bar) are mockup chrome, not app UI. This renders responsive
  full-viewport, swapping sidebar ↔ tab bar at 960px.

## Layout

```
src/
  app/                 routes + API handlers
    api/plan/          POST — dump → replanned day
    api/tasks/parse/   POST — one phrase → one task
  components/          each folder has .md docs alongside the .tsx
  lib/                 domain types, date/format helpers, planner, AI layer
  store/               Zustand store + SSR-safe provider
```

Every component ships a `.md` next to it describing props, behaviour and
gotchas. Start there before changing one.

## How planning works

```
CaptureOverlay  ──POST /api/plan──►  Claude (structured outputs)
                                       │
                                     zod-validated, capacity re-checked
                                       │
                                     tasks + day_plan  ──►  store  ──►  Today
```

- **Structured outputs** (`output_config.format` + `zodOutputFormat`) constrain
  the model to the schema in `src/lib/ai/schema.ts`, so malformed JSON isn't a
  failure mode to handle.
- **The server re-checks capacity.** A schema guarantees shape, not arithmetic:
  anything the model labelled `today` that pushes the day over budget is moved
  to deferred, and the capacity note is regenerated from the final counts. The
  Today header can never contradict the sections beneath it.
- **A dump replans everything outstanding**, not just the new text. Existing
  tasks are sent with their ids and echoed back, so completion state and React
  keys survive.

### Running without a key

Both routes fall back to a keyword heuristic planner (`src/lib/planner.ts`)
that implements the same contract — split, estimate, tag, fit to capacity,
defer the rest. The whole loop works offline. `planner: "ai" | "heuristic"` in
the response says which path ran.

The client adds a second layer: if the route itself is unreachable it plans
locally. A 4xx is *not* retried locally — that means the request was rejected,
and quietly producing a different answer would hide a real bug.

## Theme

Light is the default. Dark is the palette the designs actually specify;
light is derived from it in `globals.css` (same flat surfaces, same single red
accent, neutral ramp inverted).

Theme lives in its own `localStorage` key so the inline script in
`app/layout.tsx` can apply it before first paint without parsing the store —
otherwise a dark-mode user gets a light flash on every navigation.

## Voice

Web Speech API, feature-detected. Click to start, click again to stop — the
browser's end-of-speech timeout doesn't end the session. Permission is
confirmed *before* the UI enters the listening state, so the mic never appears
to be recording when it isn't; a blocked mic gets an explanatory dialog. Where
`SpeechRecognition` is absent the mic button isn't rendered.

## Known rough edges

- The brief's fluid rem ladder has a discontinuity (the `max-width:1200px` step
  resolves to ~10.5px root at a 1000px viewport). It's implemented but each
  step is wrapped in `clamp()` with a 13px floor. Remove the clamps for the
  raw curve.
- Deferral rarely fires at the spec'd 480-minute capacity — it takes a genuinely
  overloaded dump. The seed fixture hard-codes the designed 4/2 split so a cold
  open shows the Deferred section.
- Settings and Log out in the profile menu are presentational; auth is phase 2.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
