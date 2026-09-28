# Product research

Open Research and follow Open free eBay Product Research. Research comparable new items for UK buyers, then enter the product, total units sold, reporting period, and average sold price including postage. Optional sell-through and seller count provide context. These figures are entered by the seller, not retrieved or independently verified by the app.

Set the desired profit, applicable eBay fees, promotion allowance, other costs, maximum delivery time and processing allowance. Find CJ matches checks live CJ candidates against the researched price with no price tolerance. It rejects weak title matches, missing prices and delivery estimates, and quotes whose upper transit estimate plus processing exceeds the delivery limit. It samples up to five CJ products and three variants per product; results do not represent all variants or the entire CJ catalogue. Confirm compatibility and the actual variant before publishing.

Edit research updates saved evidence and cost assumptions. Creating a draft carries across the research reference and fee/profit settings but leaves pricing review required. Shipping and costs must be confirmed for the final selected variants. No eBay API sales-history permission or paid research subscription is needed for this manual-evidence workflow. Live CJ credentials are required for matching.

CSV import remains available for existing research exports. ZIK documents exports from My Products through Export all items or Export selected items:
https://help.zikanalytics.com/en/articles/7958969-how-to-upload-items-to-lister-tools-using-csv-file-a-guide

The import previews the first row and lets you select columns. Only the product title is required. Map an eBay listing URL, delivered GBP price and units sold if those are present. Leave an item-only price or non-GBP price unmapped. Enter the actual reporting period for sales; do not label lifetime sales as 30-day sales. Imports support up to 200 rows, deduplicate entries and persist on the app server, including access from a phone.

The separate niche search still compares active asking prices with known postage and uses default fees of 12.8% plus GBP 0.30, not completed sales. Saved research matching uses your supplied sold price and fees. Defaults are editable estimates, not a confirmation of the fees that apply to your account. Recorded sales for comparable items do not predict your own sales.

This is an export/manual workflow, not a direct ZIK API connection. No ZIK subscription is purchased and no listings are automatically published. Live matching still requires the app's eBay and CJ connections. Test exports with unfamiliar layouts using the column selectors; an actual user export has not yet been validated.

For isolated UI verification, run `node scripts/preview-research.mjs 5199`. It creates a temporary app with sample data and no copied credentials. Stop the preview with Ctrl+C.
