import { verify } from "node:crypto";

export async function verifyDeletion(raw, header, getKey) {
  let signature;
  try { signature = JSON.parse(Buffer.from(header || "", "base64").toString("utf8")); } catch { return null; }
  if (!/^[\w-]{1,200}$/.test(signature?.kid || "") || typeof signature.signature !== "string") return null;
  const key = await getKey(signature.kid);
  let body;
  try {
    body = JSON.parse(raw);
    const bytes = Buffer.from(signature.signature, "base64");
    // eBay's SDK verifies the compact JSON representation; also accept the signed raw bytes.
    if (!verify("sha1", Buffer.from(raw), key, bytes) && !verify("sha1", Buffer.from(JSON.stringify(body)), key, bytes)) return null;
  } catch { return null; }
  if (body.metadata?.topic !== "MARKETPLACE_ACCOUNT_DELETION" || !body.notification?.data?.userId) return null;
  return body.notification.data;
}

export function deletionPlan(store, token, identity, userId) {
  const current = identity?.userId === userId;
  const owns = (item) => item.ebayOwnerId === userId || (current && !item.ebayOwnerId);
  return { store: { ...store, ...(current ? { repricing: {} } : {}), drafts: (store.drafts || []).filter((row) => !owns(row)), published: (store.published || []).filter((row) => !owns(row)) },
    clearConnection: token?.userId === userId || current, clearIdentity: current };
}
