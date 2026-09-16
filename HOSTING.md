# Render and Neon

Create a Render Web Service from the GitHub repository, or use New > Blueprint
to load render.yaml. Choose Free, build command `npm ci`, start command
`npm start`, and health check `/healthz`.

In Neon, open the project's Connect dialog. Copy the pooled PostgreSQL connection
string directly into Render's DATABASE_URL environment variable. Keep its SSL
parameters. Never commit this value or the local .env file.

Required Render environment variables:

- NODE_ENV: production
- DATABASE_URL: Neon connection string
- APP_USERNAME: your chosen dashboard username
- APP_PASSWORD: a unique password of at least 16 characters
- EBAY_ENV: sandbox initially
- EBAY_LIVE_PUBLISH: false initially
- CJ_USE_LIVE: true

Copy the needed CJ and eBay values from your local .env into Render's private
environment settings. Use .env.example as the list of supported names. Do not
copy PORT. Set APP_URL to your Render HTTPS address after the first deployment.

The browser prompts for your dashboard username and password. eBay credentials
remain separate. Sign in to the hosted dashboard before starting eBay OAuth.

In eBay's RuName settings use the deployed site's URLs:

- Privacy policy: https://YOUR-SERVICE.onrender.com/privacy.html
- Auth accepted: https://YOUR-SERVICE.onrender.com/auth/ebay/callback
- Auth declined: https://YOUR-SERVICE.onrender.com/auth/ebay/declined

The deletion endpoint is /api/ebay/marketplace-account-deletion. Set
EBAY_MARKETPLACE_DELETION_ENDPOINT to its exact full HTTPS URL and set
EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN to the same 32-80 character token
entered in eBay. Its current POST handler acknowledges notifications only;
actual account-data deletion handling still needs implementation before
claiming production compliance. Free hosting sleep can also delay delivery.

Neon tables are created automatically on startup. Hosted storage starts empty;
existing local drafts and tokens are not automatically uploaded. Connect CJ and
eBay again on the hosted dashboard. Check that a draft survives a Render restart
before enabling publishing. Retain one running application instance for now;
the existing draft updates use read-modify-write operations.

Render Free sleeps when idle and has temporary local storage. All app documents
use Neon when DATABASE_URL is set; a database outage does not switch to local
files. Scheduled pricing updates and always-on notifications need separate work.

Verification: `node --test hosting.test.mjs`.
