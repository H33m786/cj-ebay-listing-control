export const identityScope = "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly";

export async function linkedEbayProfile(environment, getToken, request = fetch) {
  // The Identity sandbox returns mock users, not the connected test seller.
  if (environment !== "production") return { username: null, message: "Account names are unavailable in Sandbox." };
  try {
    const token = await getToken();
    if (token.environment !== environment) return { username: null, message: "Reconnect eBay for this environment." };
    const response = await request("https://apiz.ebay.com/commerce/identity/v1/user/", {
      headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status === 401 || response.status === 403) {
      return { username: null, message: "Reconnect eBay to allow account name access." };
    }
    if (!response.ok) throw new Error("Profile unavailable");
    const profile = await response.json();
    const username = typeof profile.username === "string" ? profile.username.trim() : "";
    return username ? { username, message: "" } : { username: null, message: "eBay has not provided an account name." };
  } catch {
    return { username: null, message: "Account name unavailable. Refresh to retry." };
  }
}

export function refreshScopes(token, scopes) {
  // Refresh cannot add permissions to an existing authorization.
  return token.scope || scopes.filter((scope) => scope !== identityScope).join(" ");
}
