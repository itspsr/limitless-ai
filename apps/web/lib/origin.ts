// Reverse proxies should preserve Host and configure the canonical AUTH_URL.
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (process.env.AUTH_URL)
      return url.origin === new URL(process.env.AUTH_URL).origin;
    return (
      ["https:", "http:"].includes(url.protocol) &&
      url.host === req.headers.get("host")
    );
  } catch {
    return false;
  }
}
