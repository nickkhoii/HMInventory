export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 && !path.startsWith("auth/login"))
    window.dispatchEvent(new Event("hm:session-expired"));
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.ok
        ? "The server returned an invalid response. Please try again."
        : `Request failed (${res.status}). Please try again.`,
    );
  }
  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status}). Please try again.`;
    throw new Error(message);
  }
  return data as T;
}
