const fields = [
  ["EBAY_MERCHANT_LOCATION_KEY", "Merchant location"],
  ["EBAY_PAYMENT_POLICY_ID", "Payment policy"],
  ["EBAY_RETURN_POLICY_ID", "Return policy"],
  ["EBAY_FULFILLMENT_POLICY_ID", "Fulfilment policy"]
];

export function publishingSetup(env, token, environment) {
  const connectionReady = Boolean(token.connected && token.environment === environment);
  const selections = fields.map(([key, label]) => ({
    label, key, value: (env[key] || "").trim()
  }));
  const missing = selections.filter(item => !item.value).map(item => item.label);
  return { connectionReady, selections, missing, ready: connectionReady && missing.length === 0 };
}
