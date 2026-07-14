/** Uniform server-action result: success with optional data, or a message. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; passwordRequired?: boolean }
