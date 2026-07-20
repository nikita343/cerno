/**
 * Identifier generation.
 *
 * Ids must be UUIDs because that is the primary key type in Postgres — the old
 * `task-<dump>-<index>` scheme would be rejected on insert. Generating them
 * here rather than letting the database default fire means the planner can
 * reference a task's id while assembling the response, before anything is
 * written.
 */
export function newId(): string {
  // Available in browsers on https/localhost and in Node 19+.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for insecure contexts. Not cryptographically strong, but these
  // ids are row identifiers, not secrets or capabilities.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
