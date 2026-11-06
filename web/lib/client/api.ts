"use client";

/// Calls one of this website's API routes. Throws an Error with the server's message when the call fails.
export async function api<T = unknown>(path: string, body?: unknown, method?: "GET" | "POST"): Promise<T> {
  const response = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { code: string; message: string } } & T;
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status})`);
  return data;
}

export const DEFAULT_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
