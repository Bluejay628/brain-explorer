// Small, polite HTTP helper for external research APIs.
//  - Spaces requests out so we stay under each provider's rate limit.
//  - Retries temporary failures (429 / 5xx / network) with exponential backoff.
//  - Times out slow requests instead of hanging forever.

export class ExternalApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

export class RateLimiter {
  private nextSlot = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  }
}

export interface FetchOptions {
  limiter?: RateLimiter;
  retries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<string> {
  const { limiter, retries = 3, timeoutMs = 20_000, fetchImpl = fetch, headers = {} } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    await limiter?.wait();
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json, application/xml;q=0.9, */*;q=0.5", ...headers },
      });
      if (res.ok) return await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new ExternalApiError(`HTTP ${res.status} from ${new URL(url).host}`, res.status, retryable);
      if (!retryable) break;
    } catch (err) {
      // Network failure or timeout — worth retrying.
      lastError = new ExternalApiError(
        `Could not reach ${new URL(url).host}: ${(err as Error).message}`,
        undefined,
        true,
      );
    }
  }
  throw lastError;
}
