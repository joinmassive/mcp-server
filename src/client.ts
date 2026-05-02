import { API_BASE, USER_AGENT, X_SOURCE } from "./types.js";

export interface MassiveErrorDetail {
  status?: number;
  body?: string;
}

export class MassiveClientError extends Error {
  public readonly detail: MassiveErrorDetail;

  constructor(message: string, detail: MassiveErrorDetail = {}, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.name = "MassiveClientError";
    this.detail = detail;
  }
}

type FetchImpl = typeof fetch;

export interface MassiveClientOptions {
  fetchImpl?: FetchImpl;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export type QueryValue = string | number | boolean | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const DEFAULT_503_RETRY_MS = 5_000;
const MAX_RETRY_AFTER_MS = 30_000;

export class MassiveClient {
  private cachedToken: string | undefined;
  private readonly fetchImpl: FetchImpl;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: MassiveClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? API_BASE;
    this.timeoutMs = options.timeoutMs ?? readPositiveIntEnv("MASSIVE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  private resolveToken(): string {
    if (this.cachedToken) return this.cachedToken;
    const token = process.env.MASSIVE_TOKEN;
    if (!token) {
      throw new MassiveClientError(
        "MASSIVE_TOKEN env var is not set. Get an API key at https://dashboard.joinmassive.com/developer/api-keys",
      );
    }
    this.cachedToken = token;
    return token;
  }

  async get<T = unknown>(path: string, params: QueryParams = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    let res = await this.doFetch(url);

    if (res.status === 503) {
      const waitMs = parseRetryAfter(res.headers.get("retry-after")) ?? DEFAULT_503_RETRY_MS;
      await delay(waitMs);
      res = await this.doFetch(url);
    }

    return this.handleResponse<T>(res);
  }

  private async doFetch(url: string): Promise<Response> {
    const token = this.resolveToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": USER_AGENT,
          "X-Source": X_SOURCE,
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        throw new MassiveClientError(
          `Request timed out after ${this.timeoutMs}ms`,
          {},
          err instanceof Error ? err : undefined,
        );
      }
      const cause = err instanceof Error ? err : undefined;
      const message = err instanceof Error ? err.message : String(err);
      throw new MassiveClientError(`Network error: ${message}`, {}, cause);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, params: QueryParams): string {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 503) {
      throw new MassiveClientError("Massive endpoint is autoscaling, please retry", { status: 503 });
    }
    if (res.status === 403) {
      const body = await this.readBodyCapped(res).catch(() => "");
      throw new MassiveClientError(
        "403 Forbidden — the request was rejected (likely captcha or invalid token).",
        { status: 403, body },
      );
    }
    if (!res.ok) {
      const body = await this.readBodyCapped(res).catch(() => "");
      throw new MassiveClientError(`HTTP ${res.status} — upstream error`, { status: res.status, body });
    }
    const body = await this.readBodyCapped(res);
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return JSON.parse(body) as T;
    }
    return body as unknown as T;
  }

  private async readBodyCapped(res: Response): Promise<string> {
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > this.maxResponseBytes) {
          await reader.cancel().catch(() => undefined);
          throw new MassiveClientError(
            `Response too large: exceeds ${this.maxResponseBytes} byte size limit`,
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock?.();
    }
    return concatChunksAsString(chunks, received);
  }
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return Math.min(Math.max(delta, 0), MAX_RETRY_AFTER_MS);
  }
  return undefined;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

function concatChunksAsString(chunks: Uint8Array[], totalBytes: number): string {
  if (chunks.length === 1 && chunks[0]) {
    return new TextDecoder("utf-8").decode(chunks[0]);
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
