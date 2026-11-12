export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
} | null;

/** All string form fields (including passwords, which validation needs). Never send this object to the client. */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Returns form values safe to echo back to the browser (secrets removed). */
function publicValues(values?: Record<string, string>) {
  if (!values) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (!/password/i.test(k)) out[k] = v;
  return out;
}

export function fail(message: string, values?: Record<string, string>, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, values: publicValues(values), fieldErrors };
}

export function ok(message: string): ActionState {
  return { ok: true, message };
}

export function zodFail(issues: { path: PropertyKey[]; message: string }[], values: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Please fix the highlighted fields.", values, fieldErrors);
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
