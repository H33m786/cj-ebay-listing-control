# Orders

Open Orders in the server-backed app. It reads eBay orders on opening the screen
and when Refresh orders is pressed. Choose the last 7, 30 or 90 days; use Next
and Previous to read pages of 50 orders. This is not background monitoring.

The existing OAuth connection needs sell.fulfillment or
sell.fulfillment.readonly permission. Reconnect in Settings if eBay refuses
order access. Sandbox and production use their respective connected accounts.

Each order displays the purchased variations supplied by eBay, quantity,
payment/cancellation/fulfilment status, ship-by dates, buyer checkout note and
delivery instructions. The delivery address is taken from shippingStep.shipTo,
never the buyer's registration address. Missing data is marked unavailable.

CJ matching requires an exact published eBay listing ID and SKU in the same
environment. Unmatched or ambiguous items are explicitly flagged; product
titles are not used to guess CJ variants. Confirm all details on CJ before
placing or paying for an order. The screen does not place supplier orders,
charge money, mark items as shipped, or save tracking numbers. Check CJ/eBay
before fulfilment to avoid duplicates and late cancellations.

Order details are fetched through the login-protected server endpoint with
Cache-Control: no-store. They are not saved to the app database, local files or
browser localStorage. Leaving Orders clears the rendered details. Copy address
explicitly places the address on the operating system clipboard.

Verification: node --test orders.test.mjs hosting.test.mjs
Browser smoke test: scripts/check-orders-ui.mjs uses synthetic orders only and
requires Playwright, Edge, CODEX_NODE_MODULES pointing to its package directory,
and a running app at TEST_APP_URL (default http://localhost:5174).
