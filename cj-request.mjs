export function createCjRequester({ fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now, intervalMs = 1100 } = {}) {
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  return function request(url, options = {}, { attempts = 4, timeoutMs = 20000 } = {}) {
    const run = async () => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const delay = Math.max(0, nextRequestAt - now());
        if (delay > 30000) throw new Error("CJ is temporarily rate-limiting requests. Please retry later.");
        if (delay) await sleep(delay);
        nextRequestAt = now() + intervalMs;
        const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
        const data = await response.json().catch(() => ({}));
        const message = String(data.message || data.error || `CJ API failed with ${response.status}`);
        const limited = response.status === 429 || /too many requests|rate limit|too frequent|frequent request/i.test(message);
        if (!limited && response.ok && data.code === 200) return data;
        if (!limited) throw new Error(message);
        const retryAfter = response.headers?.get("retry-after");
        const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
        const serverDelay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now();
        const backoff = Math.max(2000 * 2 ** attempt, Number.isFinite(serverDelay) ? serverDelay : 0);
        nextRequestAt = Math.max(nextRequestAt, now() + backoff);
        if (attempt === attempts - 1 || backoff > 30000) throw new Error("CJ is temporarily rate-limiting requests. Please retry later; the cooldown is being respected.");
      }
      throw new Error("CJ request could not be completed.");
    };
    const pending = queue.then(run);
    queue = pending.catch(() => {});
    return pending;
  };
}
