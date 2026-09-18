import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function localReturnPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  const parsed = new URL(value, "https://local.invalid");
  return parsed.origin === "https://local.invalid" && !["/login", "/logout"].includes(parsed.pathname) ? parsed.pathname + parsed.search : "/";
}

function loginPage(next, error = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in | CJ to eBay</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f8f6;color:#18201d;font:16px system-ui,sans-serif}header{padding:24px;background:#17221e;color:white}header h1{font-size:24px;margin:0}main{max-width:420px;margin:64px auto;padding:0 24px}h2{font-size:24px;margin:0 0 28px}label{display:block;font-weight:600;margin:20px 0 8px}input{display:block;width:100%;min-height:46px;border:1px solid #aab5af;border-radius:4px;padding:10px;font:inherit}button{margin-top:28px;width:100%;min-height:46px;background:#116149;color:white;border:0;border-radius:4px;font:inherit;font-weight:600;cursor:pointer}input:focus,button:focus{outline:3px solid #78b7da;outline-offset:2px}.error{color:#a1362f;line-height:1.5;overflow-wrap:anywhere}@media(max-width:500px){main{margin-top:40px}}
  </style></head><body><header><h1>CJ to eBay</h1></header><main><h2>Sign in</h2>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<form method="post" action="/login"><input type="hidden" name="next" value="${escapeHtml(next)}"><label for="username">Username</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="200" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="1000" required><button type="submit">Sign in</button></form></main></body></html>`;
}

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
  const secure = hosted || (env.APP_URL || env.RENDER_EXTERNAL_URL || "").startsWith("https:");
  const cookieName = secure ? "__Host-cj-session" : "cj-session";
  const ttl = 8 * 60 * 60;
  const sign = (payload) => createHmac("sha256", expected).update(`session:${payload}`).digest("base64url");
  const headers = (res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
  };
  const sameOrigin = (req, url, required = false) => {
    const origin = new URL(env.APP_URL || env.RENDER_EXTERNAL_URL || url.origin).origin;
    return req.headers["sec-fetch-site"] !== "cross-site" && (req.headers.origin ? req.headers.origin === origin : !required);
  };
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const validSession = (req) => {
    const value = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!value || value.length > 1024) return false;
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra || !timingSafeEqual(digest(sign(payload)), digest(signature))) return false;
    try { const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return Number.isSafeInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000); }
    catch { return false; }
  };
  const publicPaths = new Set(["/healthz", "/privacy.html", "/auth/ebay/declined", "/api/ebay/marketplace-account-deletion"]);
  const guard = (req, res, url) => {
    headers(res);
    if (publicPaths.has(url.pathname)) return true;
    if (!username) return true;
    const authorization = req.headers.authorization || "";
    const supplied = authorization.startsWith("Basic ") ? Buffer.from(authorization.slice(6), "base64").toString("utf8") : "";
    const basic = authorization.startsWith("Basic ") && timingSafeEqual(digest(supplied), expected);
    if (!basic && !validSession(req)) {
      if (req.method === "GET" && !url.pathname.startsWith("/api/") && (req.headers.accept || "").includes("text/html")) {
        res.writeHead(302, { location: `/login?next=${encodeURIComponent(localReturnPath(url.pathname + url.search))}` });
        res.end();
      } else {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Your session has expired or you are not signed in. Open /login to sign in." }));
      }
      return false;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!sameOrigin(req, url, !basic)) {
        res.writeHead(403);
        res.end("Request origin is not allowed.");
        return false;
      }
    }
    return true;
  };
  let failedAttempts = 0;
  let resetAt = 0;
  guard.handleSession = async (req, res, url) => {
    if (!["/login", "/logout"].includes(url.pathname)) return false;
    headers(res);
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    const page = (status, next = "/", error = "") => { res.writeHead(status, { "content-type": "text/html; charset=utf-8" }); res.end(loginPage(next, error)); };
    if (req.method === "GET" && url.pathname === "/login") {
      page(200, localReturnPath(url.searchParams.get("next")));
      return true;
    }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); res.end(); return true; }
    if (!sameOrigin(req, url, true)) { page(403, "/", "Sign-in request blocked. Open this page directly and try again."); return true; }
    if (url.pathname === "/logout") {
      res.setHeader("Set-Cookie", cookie("", 0));
      res.writeHead(303, { location: username ? "/login" : "/" }); res.end(); return true;
    }
    if (Date.now() >= resetAt) { failedAttempts = 0; resetAt = Date.now() + 60000; }
    if (failedAttempts >= 5) { res.setHeader("Retry-After", "60"); page(429, "/", "Too many sign-in attempts. Wait a minute and try again."); return true; }
    if (!(req.headers["content-type"] || "").startsWith("application/x-www-form-urlencoded")) { page(415, "/", "Use the sign-in form to continue."); return true; }
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += Buffer.byteLength(chunk);
      if (length > 4096) { page(413, "/", "Sign-in request is too large."); return true; }
      chunks.push(Buffer.from(chunk));
    }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const next = localReturnPath(form.get("next"));
    const correctUser = timingSafeEqual(digest(form.get("username") || ""), digest(username));
    const correctPassword = timingSafeEqual(digest(form.get("password") || ""), digest(password));
    if (!username || !correctUser || !correctPassword) {
      failedAttempts++;
      page(401, next, "Username or password is incorrect."); return true;
    }
    failedAttempts = 0;
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl, nonce: randomBytes(16).toString("hex") })).toString("base64url");
    res.setHeader("Set-Cookie", cookie(`${payload}.${sign(payload)}`, ttl));
    res.writeHead(303, { location: next }); res.end(); return true;
  };
  return guard;
}
