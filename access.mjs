import { createHash, timingSafeEqual } from "node:crypto";

export function createAccessGuard(env) {
  const hosted = env.RENDER === "true" || env.NODE_ENV === "production";
  const username = env.APP_USERNAME || "";
  const password = env.APP_PASSWORD || "";
  if (hosted && (!env.DATABASE_URL || !username || password.length < 16)) {
    throw new Error("Hosting requires DATABASE_URL, APP_USERNAME and APP_PASSWORD (at least 16 characters).");
  }
  if (Boolean(username) !== Boolean(password)) throw new Error("Set both APP_USERNAME and APP_PASSWORD.");
  const digest = (value) => createHash("sha256").update(value).digest();
  const expected = digest(`${username}:${password}`);
  const publicPaths = new Set(["/healthz", "/privacy.html", "/auth/ebay/declined", "/api/ebay/marketplace-account-deletion"]);
  return (req, res, url) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    if (publicPaths.has(url.pathname)) return true;
    if (!username) return true;
    const authorization = req.headers.authorization || "";
    const supplied = authorization.startsWith("Basic ") ? Buffer.from(authorization.slice(6), "base64").toString("utf8") : "";
    if (!timingSafeEqual(digest(supplied), expected)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="CJ to eBay", charset="UTF-8"', "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Sign in to access your listings." }));
      return false;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = env.APP_URL || env.RENDER_EXTERNAL_URL || url.origin;
      if (req.headers["sec-fetch-site"] === "cross-site" || (req.headers.origin && req.headers.origin !== new URL(origin).origin)) {
        res.writeHead(403);
        res.end("Request origin is not allowed.");
        return false;
      }
    }
    return true;
  };
}
