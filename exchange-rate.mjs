const frankfurterUrl = "https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP";

export function parseUsdToGbpRate(data = {}) {
  const row = Array.isArray(data) ? data.find((item) => String(item.base).toUpperCase() === "USD" && String(item.quote).toUpperCase() === "GBP") : data;
  const rate = Number(row?.rate ?? row?.rates?.GBP ?? row?.rates?.gbp);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 2) throw new Error("Live USD to GBP exchange rate was unavailable.");
  return {
    base: "USD",
    quote: "GBP",
    rate: Number(rate.toFixed(6)),
    date: row.date || null,
    source: "Frankfurter"
  };
}

export async function fetchUsdToGbpRate(fetcher = fetch) {
  const response = await fetcher(frankfurterUrl, { headers: { accept: "application/json" } });
  if (!response?.ok) throw new Error(`Live USD to GBP exchange rate failed with ${response?.status || "no response"}.`);
  return parseUsdToGbpRate(await response.json());
}
