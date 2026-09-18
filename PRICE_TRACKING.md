# Daily price tracking

Price tracking is opt-in and starts with automatic updates disabled. In the
server-backed app, open Price tracking, select published listings, and set each
listing's target margin, GBP charged per USD, and exact CJ shipping service name.
Save and run Check prices (preview) first. The exchange rate is entered manually;
it is not a live exchange-rate feed. Fee estimates and other costs remain those
saved with the listing. Verify those against your actual eBay account fees.

The checker fetches fresh CJ variant prices and one-item China-to-UK quotes
using the saved quote postcode where present. No substitute service is selected.
Unavailable quotes, manual-only shipping services, ambiguous offers, missing
variants, and non-GBP offers are held for review. Only verified free-postage
policies are supported in this first version. Postcode quotes are estimates,
not guaranteed costs for every UK destination or multi-item order. Delivery
times are not automatically revised; review them with CJ separately.

The existing target-margin formula includes item cost, shipping, saved FX,
estimated eBay percentage and fixed fees, and other saved GBP costs. Each
selected variation is calculated independently. A maximum automatic price
change defaults to 20% in either direction (configurable up to 25%). Larger
changes are held, not clamped. A held listing remains at its existing eBay price.
Preview does not change eBay. Review the history for failures and held prices.

Enabling Apply prices to eBay automatically asks for confirmation. Actual
updates also require the existing EBAY_LIVE_PUBLISH=true flag, and in production
EBAY_PRODUCTION_CONFIRM=REAL_LISTINGS_ENABLED. Tracking approval is bound to the
current OAuth connection; reconnecting requires saving settings again. An older
connection without a connection ID must reconnect before enabling automation.
Only the price is sent to eBay. Stock, descriptions and postage policies are not
rewritten. The current active eBay offer is checked before and after an update.
An uncertain response is logged for review, never reported as a confirmed update.

## Daily execution

Daily checks are due once per UTC date from 07:17 UTC. An always-running server
checks for due work every minute. Render's free service sleeps when idle, so the
in-process timer alone is not a reliable scheduler. The supplied GitHub Actions
workflow `.github/workflows/daily-pricing.yml` wakes the hosted app daily and
monitors the run. It must be deployed on the repository's default branch.

Add these GitHub repository Actions secrets (never commit their values):
- APP_URL: the HTTPS Render app address.
- APP_USERNAME: the dashboard login username.
- APP_PASSWORD: the dashboard login password.

Enable Actions for the repository, enable Daily checks in the app, and manually
run Daily CJ price check once to verify connectivity. Keep automatic updates off
until a preview has been reviewed. GitHub scheduled jobs can be delayed and are
subject to account quotas and inactivity rules; this is not real-time pricing.
On-demand previews remain available without GitHub Actions. No cloud schedule
or secret has been configured merely by adding these files locally.

Each daily attempt is recorded before supplier calls, avoiding repeated failed
attempts or writes within the same day. Use a manual preview/check after resolving
failures. The GitHub job fails for review-needed outcomes. There are no customer
orders or payments created by this job.

## Reliability and storage

Use one app web instance with Neon storage. The job shares the app's mutation
queue and obtains a PostgreSQL advisory lock, preventing overlapping price jobs
during deploys. Other app writers are designed for a single web instance, not
horizontal scaling. Local document writes are atomic. History is limited to the
latest 200 events per listing and the screen displays the latest 100 events.
Price updates across variants are independent, not an eBay atomic transaction;
partial success remains visible. After a crash, inspect the interrupted status
and run a preview to reconcile with actual eBay prices.

The checker stops making new supplier requests after 15 minutes in a run and
flags remaining rows. API requests have timeouts. This initial implementation
is intended for a small catalogue; review the history if a larger catalogue
exceeds API limits or runtime bounds.

Tests use synthetic eBay/CJ responses. Live production updates have not been
performed as part of implementation.
