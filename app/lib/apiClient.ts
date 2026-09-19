// Client-side helpers for calling this app's JSON API from components.
// Every call resolves to the same ApiResult shape so UI code never
// hand-parses fetch responses, and error extraction is consistent.

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Extracts the `{ error }` string from a failed JSON response. Falls back
// to a generic message when the body is missing, empty, or not JSON.
async function errorFrom(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Body was not JSON — fall through to the generic message.
  }
  return `Request failed (${res.status})`;
}

const NETWORK_ERROR = "Network error — try again";

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

// Multipart upload (used only for the blueprint image), same result shape.
export async function apiSendForm<T>(
  path: string,
  form: FormData,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { method: "POST", body: form });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
