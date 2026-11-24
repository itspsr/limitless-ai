import { ProviderFailure, type History, type Limits, type ProviderAdapter, type StreamChunk } from "../../core/src/index.ts";

function count(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
}
function reset(value: string | null): number | undefined {
  if (!value) return;
  if (/^\d+(\.\d+)?$/.test(value)) return Date.now() + Number(value) * 1000;
  const duration = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value);
  if (duration) return Date.now() + 1000 * (Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0));
  const date = Date.parse(value);
  return Number.isFinite(date) ? date : undefined;
}

export function openAICompatible(base: string, key: string, model: string, fetcher = fetch): ProviderAdapter {
  const endpoint = new URL(base);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("A clean HTTPS API base URL is required");
  }
  async function request(path: string, signal: AbortSignal, body?: object) {
    const response = await fetcher(endpoint.href.replace(/\/$/, "") + path, {
      signal, redirect: "error", method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const quota = response.status === 429 || (response.status === 403 && /quota|rate.limit/i.test(await response.text()));
      throw new ProviderFailure(quota ? "Provider quota reached" : "Provider returned HTTP " + response.status,
        quota || response.status >= 500 || response.status === 408, parseRateLimitHeaders(response.headers).resetAt);
    }
    return response;
  }
  function parseRateLimitHeaders(headers: Headers): Limits {
    return {
      remainingRequests: count(headers.get("x-ratelimit-remaining-requests")),
      remainingTokens: count(headers.get("x-ratelimit-remaining-tokens")),
      resetAt: reset(headers.get("retry-after") ?? headers.get("x-ratelimit-reset-requests")),
    };
  }
  async function* stream(history: History, signal: AbortSignal): AsyncGenerator<StreamChunk> {
    const response = await request("/chat/completions", signal, {model, messages: history, stream: true});
    yield { limits: parseRateLimitHeaders(response.headers) };
    if (!response.body) throw new ProviderFailure("Empty response stream", true);
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) throw new ProviderFailure("Stream interrupted", true);
        pending += part.value;
        let boundary;
        while ((boundary = /\r?\n\r?\n/.exec(pending))) {
          const frame = pending.slice(0, boundary.index);
          pending = pending.slice(boundary.index + boundary[0].length);
          const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
          if (!data) continue;
          if (data.trim() === "[DONE]") return;
          const event = JSON.parse(data);
          if (event.error) throw new ProviderFailure("Upstream stream failed", true);
          const text = event.choices?.[0]?.delta?.content;
          if (typeof text === "string") yield {text};
          if (Number.isSafeInteger(event.usage?.total_tokens)) yield {totalTokens: event.usage.total_tokens};
        }
        if (pending.length > 2_000_000) throw new ProviderFailure("Oversized stream event", true);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  return {
    stream, parseRateLimitHeaders,
    async chat(history, signal) {
      let answer = "";
      for await (const chunk of stream(history, signal)) answer += chunk.text ?? "";
      return answer;
    },
    async listModels(signal) {
      const response = await request("/models", signal);
      const result = await response.json();
      return result.data.map((item: {id: string}) => item.id);
    },
    normalizeError(error) {
      return error instanceof ProviderFailure ? error : new ProviderFailure("Provider connection interrupted", true);
    },
  };
}
