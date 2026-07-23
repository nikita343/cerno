import "server-only";

/**
 * A best-effort scanner that pulls complete objects out of the `tasks` array
 * of a JSON document *while it is still being written*.
 *
 * The planning model streams its output as a growing JSON string:
 *
 *   {"tasks":[ {..first..}, {..second..}, {..thi
 *
 * We want to surface each task the moment its closing brace arrives, so the
 * capture modal can show it appear instead of a blank loader for ~20s. This
 * scanner is fed the accumulating snapshot on every delta and returns any task
 * objects that have completed since the last call.
 *
 * It is deliberately *best-effort*: the authoritative parse still comes from the
 * SDK's `finalMessage().parsed_output`, so a task this scanner misses (or a
 * malformed fragment it skips) is never lost — it simply arrives a beat later in
 * the final result. That lets the scanner stay a simple brace/quote counter
 * rather than a full streaming JSON parser.
 */
export function createTaskArrayScanner() {
  /** How far into the snapshot we've already consumed. */
  let pos = 0;
  /** Index of the `[` that opens the tasks array, once found. */
  let arrayStart = -1;
  /** True once we've passed the `]` that closes the tasks array. */
  let done = false;

  // State carried across calls while walking the array body.
  let depth = 0; // brace depth relative to the array
  let inString = false;
  let escaped = false;
  let objStart = -1; // start index of the object currently being read

  /**
   * Feed the latest cumulative snapshot. Returns the substrings of any task
   * objects that closed since the previous call, in order.
   */
  function push(snapshot: string): string[] {
    const found: string[] = [];
    if (done) return found;

    // Locate the tasks array once. `"tasks"` then the next `[`.
    if (arrayStart < 0) {
      const key = snapshot.indexOf('"tasks"');
      if (key < 0) return found;
      const bracket = snapshot.indexOf("[", key);
      if (bracket < 0) return found;
      arrayStart = bracket;
      pos = bracket + 1;
    }

    for (let i = pos; i < snapshot.length; i++) {
      const ch = snapshot[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && objStart >= 0) {
          found.push(snapshot.slice(objStart, i + 1));
          objStart = -1;
        }
      } else if (ch === "]" && depth === 0) {
        // End of the tasks array — everything after is summary, not our concern.
        done = true;
        pos = i + 1;
        return found;
      }
    }

    pos = snapshot.length;
    return found;
  }

  return { push };
}
