import { setTimeout as sleep } from "node:timers/promises";

export interface FetchOptions {
  userAgent: string;
  timeoutMs: number;
  retries: number;
  /** Base delay before a retry; multiplied by the attempt number. */
  backoffMs?: number;
}

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

function retryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500;
  // fetch rejects with TypeError on network failures and DOMException on timeout.
  return true;
}

function retryDelay(error: unknown, attempt: number, backoffMs: number): number {
  if (error instanceof HttpError && error.status === 429)
    return Math.max(3000, backoffMs) * attempt;
  return backoffMs * attempt;
}

/**
 * GET a URL as text. Content-Type is ignored on purpose: some feeds are served as text/plain.
 * Retries on network errors, 5xx and 429; any other status fails at once.
 */
export async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const backoffMs = options.backoffMs ?? 1000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    if (attempt > 0) await sleep(retryDelay(lastError, attempt, backoffMs));
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": options.userAgent,
          accept:
            "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.9, */*;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new HttpError(response.status, url);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (!retryable(error)) break;
    }
  }
  throw lastError;
}

export async function fetchJson(url: string, options: FetchOptions): Promise<unknown> {
  return JSON.parse(await fetchText(url, options));
}

/** Runs `task` over `items` with at most `limit` in flight, keeping the input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "timed out";
    const cause = (error as { cause?: unknown }).cause;
    return cause instanceof Error ? `${error.message} (${cause.message})` : error.message;
  }
  return String(error);
}
