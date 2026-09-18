# Dashboard sign-in

Open /login on the hosted app and use the existing APP_USERNAME and APP_PASSWORD
configured in Render. The browser password popup is no longer used. No eBay or
CJ credentials belong in this form.

Successful login creates a signed eight-hour session cookie. In production the
cookie is Secure, HttpOnly, SameSite=Lax, host-only and scoped to /. The session
contains only an expiry and a random nonce, not the username or password. Changing
the dashboard credentials invalidates existing session signatures. Sign out
clears the cookie in that browser; a previously stolen copy would still be valid
until expiry or credential rotation, so use a trusted device and HTTPS.

Login responses are not cached. Failed form logins are limited to five per
minute per app process. Mutating cookie-authenticated requests require the
configured same origin. Keep APP_URL set to the exact HTTPS dashboard origin.

The daily GitHub scheduler can still send its existing Basic Authorization
header. The server no longer sends a WWW-Authenticate browser popup challenge.
Public health, privacy and eBay deletion-notification routes remain public;
the dashboard and its order/pricing APIs remain authenticated.

Tests: node --test access.test.mjs hosting.test.mjs
Synthetic browser test: scripts/check-login-ui.mjs (Playwright and Edge).
