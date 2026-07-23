# Streaming plan — design

**Date:** 2026-07-23
**Goal:** The brain-dump plan currently blocks ~20s on a single buffered response, so the app looks empty the whole time. Stream tasks as the model produces them so planning *feels* near-instant, even though total time is similar.

## Approved decisions

- **Reveal surface:** tasks stream into a growing list *inside the capture modal*, which then closes when done and the tasks are in the timeline. (Errors stay contained in the modal; the store commit stays atomic.)
- **View on plan:** jump to the Today view (`/dashboard`) when planning starts, so the timeline is already showing when the modal closes.
- **Scope guard:** true token-streaming for the **Anthropic** path only. OpenAI and the offline heuristic stay buffered but emit through the same event shape (all tasks at once, then `done`), so the client is uniform.

## Transport

`POST /api/plan` returns `text/event-stream`. Newline-delimited JSON events:

- `{ "type": "task", "task": Task }` — one per task as it completes (drives the modal animation only).
- `{ "type": "done", "tasks": Task[], "dayPlan": DayPlan, "dump": Dump }` — authoritative final state; the client commits *this*, not its animation buffer.
- `{ "type": "error", "message": string }` — mid-stream failure.

Persistence still happens **once**, server-side, right before `done` (dump → tasks → dayPlan), exactly as today. Nothing persists mid-stream, so any failure is a clean rollback (nothing to undo in the DB; the client just discards its buffer).

## Server

- `src/lib/ai/partialJson.ts` (new) — a best-effort scanner: fed the accumulating JSON snapshot, it yields each newly-completed object substring inside the `tasks` array (tracks string/escape/brace depth, keeps a cursor across snapshots). Best-effort because the authoritative parse comes from `finalMessage().parsed_output`; a missed task still arrives in `done`.
- `src/lib/ai/generate.ts` — `generatePlanStreaming(options, onRawTask)`: Anthropic path streams via `messages.stream` `text` events + the scanner, calling `onRawTask` per completed `PlannedTask`; returns the authoritative `{ tasks, summary }` from `finalMessage()`. OpenAI path buffers, then calls `onRawTask` for each task before returning. Returns `null` when no vendor is configured (caller falls back to heuristic).
- `src/app/api/plan/route.ts` — refactor `assemble()` into an incremental assembler (`add(item) → Task`, `finalize(summary) → PlanResult`) so per-task placement (capacity guard, pinned days, ids, sort order) is computed as tasks stream and matches the final result. Route streams `task` events from `add()`, then `finalize()`, persists, emits `done`.

## Client

- `src/lib/planner.ts` — `streamPlanDump(input, { onTask }): Promise<PlanResult>`: reads the SSE stream, calls `onTask` per `task` event, resolves with the `done` payload. Offline/network failure → local `buildPlan`, emit its tasks via `onTask`, resolve (unchanged degradation contract).
- `src/store/createAppStore.ts` — add `streamingTasks: Task[]`. `submitDump` clears it, calls `streamPlanDump` with `onTask` appending to it (for the modal), and on resolve commits the `done` tasks/dayPlan/dump exactly as today, clears `streamingTasks`, closes the modal. On error: keep modal open, show `planError`, clear buffer.
- `src/components/capture/CaptureOverlay.tsx` — while thinking, render `streamingTasks` as an appearing list (fade/slide; static under reduced motion) instead of only the looping loader; navigate to `/dashboard` on submit.

## Non-goals

- No change to persistence model, capacity logic, or the heuristic/OpenAI output.
- No per-task live insertion into the real timeline behind the modal (rejected in favour of the contained modal list).
