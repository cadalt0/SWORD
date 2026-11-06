import { bodyOf, errorResponse, HttpError } from "@/lib/server/api";

export const runtime = "nodejs";

/// The API playground's way to the Sword API. The API sends no CORS headers (it is for servers), so the playground page
/// calls this route and this route calls the API, with the test key the person typed in. The key is used for this one
/// call: it is never stored or logged, and only test keys are accepted.
///
/// POST {method, path, apiKey?, body?} → {status, durationMs, headers, body}

const KEY = /^sk_test_[A-Za-z0-9]{40}$/;
/// Only API routes, so this can't be used to reach anything else.
const PATH = /^\/(health|v1\/[A-Za-z0-9/_\-]+)(\?[A-Za-z0-9_\-=&.:%]*)?$/;
const KEPT_HEADERS = ["x-ratelimit-limit", "x-ratelimit-remaining", "retry-after", "content-type"];

export async function POST(request: Request) {
  try {
    const body = await bodyOf(request);
    const method = body.method === "POST" ? "POST" : body.method === "GET" ? "GET" : undefined;
    if (!method) throw new HttpError(400, "INVALID_INPUT", "method must be GET or POST");
    const path = typeof body.path === "string" ? body.path : "";
    if (!PATH.test(path)) throw new HttpError(400, "INVALID_INPUT", "path must be an API route under /v1");
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (apiKey && !KEY.test(apiKey)) throw new HttpError(400, "TEST_KEYS_ONLY", "The playground only takes test keys (sk_test_ followed by 40 letters and digits)");

    const base = (process.env.SWORD_API_URL ?? "https://sword-api-cadalt-d47a7a90dc84.herokuapp.com").replace(/\/+$/, "");
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          accept: "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        body: method === "POST" ? JSON.stringify(body.body ?? {}) : undefined,
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      throw new HttpError(502, "API_UNREACHABLE", `Could not reach the Sword API at ${base}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const headers: Record<string, string> = {};
    for (const name of KEPT_HEADERS) {
      const value = res.headers.get(name);
      if (value) headers[name] = value;
    }
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON; shown as text
    }
    return Response.json({ status: res.status, durationMs: Date.now() - started, headers, body: parsed });
  } catch (error) {
    return errorResponse(error);
  }
}
