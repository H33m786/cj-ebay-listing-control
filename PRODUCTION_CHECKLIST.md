# Production checklist

Use this before changing `EBAY_ENV=production`.

## eBay production keys

- Create/get Production App ID, Dev ID, and Cert ID in the eBay Developer dashboard.
- Set the production RuName and OAuth accepted/declined URLs.
- Re-run OAuth against production and save a production token.
- Confirm `EBAY_MARKETPLACE_ID`, `EBAY_CURRENCY`, and default category match the seller account.
- Set up the required Marketplace Account Deletion endpoint on a public HTTPS deployment.
- Use `/api/ebay/marketplace-account-deletion` as the endpoint path.
- Set `EBAY_MARKETPLACE_DELETION_ENDPOINT` to the exact public URL and `EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN` to the same 32-80 character token entered in eBay.

## Seller setup

- Opt the production seller into Business Policies.
- Create or choose production payment, return, and fulfilment policies.
- Create a production inventory location and set `EBAY_MERCHANT_LOCATION_KEY`.

## Safety gates

- Keep `EBAY_LIVE_PUBLISH=false` while checking credentials and policy IDs.
- Only set `EBAY_LIVE_PUBLISH=true` after a manual review workflow is working.
- Production publishing stays blocked unless `EBAY_PRODUCTION_CONFIRM=REAL_LISTINGS_ENABLED`.

## CJ data

- Create a CJ API key in CJ Dropshipping, then set `CJ_API_KEY` locally.
- Use Settings -> Connect CJ API to save a local CJ access token.
- Enable `CJ_USE_LIVE=true` only after CJ connection succeeds.
- Confirm product detail enrichment returns multiple `productImageSet` URLs.
- Review category mapping, blocked brands, shipping estimates, and margin before publishing.

## First live listing

- Publish one low-risk, unbranded product with realistic delivery text.
- Verify images, price, stock, policies, and dispatch time on eBay.
- End or revise the listing immediately if anything looks wrong.
