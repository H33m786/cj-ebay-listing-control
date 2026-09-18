export function normalizeQuotes(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    if (!row.logisticName || row.logisticPrice == null) return [];
    const price = row.totalPostageFee != null ? Number(row.totalPostageFee) : Number(row.logisticPrice) + Number(row.taxesFee || 0) + Number(row.clearanceOperationFee || 0);
    if (!Number.isFinite(price) || price < 0) return [];
    return [{ name: String(row.logisticName), price, currency: "USD", transit: String(row.logisticAging || "") }];
  }).sort((a, b) => a.price - b.price);
}
