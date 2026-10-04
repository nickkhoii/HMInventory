export function allowedOrigin(
  origin: string | null,
  configured: string,
  development: boolean,
) {
  const expected = new URL(configured);
  if (origin === expected.origin) return true;
  if (!development || !origin) return false;
  try {
    const actual = new URL(origin);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      origin === actual.origin &&
      loopback.has(expected.hostname) &&
      loopback.has(actual.hostname) &&
      actual.protocol === expected.protocol &&
      actual.port === expected.port
    );
  } catch {
    return false;
  }
}
