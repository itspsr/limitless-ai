export type Message = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;
export type History = readonly Message[];
export interface Limits {
  remainingRequests?: number;
  remainingTokens?: number;
  resetAt?: number;
}
export interface StreamChunk {
  text?: string;
  totalTokens?: number;
  limits?: Limits;
}
export interface ProviderAdapter {
  chat(history: History, signal: AbortSignal): Promise<string>;
  stream(history: History, signal: AbortSignal): AsyncIterable<StreamChunk>;
  listModels(signal: AbortSignal): Promise<string[]>;
  parseRateLimitHeaders(headers: Headers): Limits;
  normalizeError(error: unknown): ProviderFailure;
}
export class ProviderFailure extends Error {
  readonly retryable: boolean;
  readonly resetAt?: number;
  constructor(message: string, retryable: boolean, resetAt?: number) {
    super(message);
    this.retryable = retryable;
    this.resetAt = resetAt;
  }
}
export interface Candidate {
  id: string;
  model: string;
  adapter: ProviderAdapter;
  availableAt: number;
}
export type Event =
  | {
      type: "switch";
      from: string;
      to: string;
      replaceDraft: boolean;
      quota?: true;
    }
  | { type: "chunk"; provider: string; chunk: StreamChunk }
  | { type: "done"; provider: string; model: string }
  | { type: "exhausted"; resetAt?: number };

export async function* route(
  candidates: readonly Candidate[],
  history: History,
  options: {
    signal: AbortSignal;
    autoSwitch: boolean;
    timeoutMs: number;
    cooldown(id: string, until: number): Promise<void>;
  },
): AsyncGenerator<Event> {
  let earliest = Infinity;
  let previous: string | undefined;
  let hasDraft = false;
  let quota = false;
  for (const candidate of options.autoSwitch
    ? candidates
    : candidates.slice(0, 1)) {
    options.signal.throwIfAborted();
    if (candidate.availableAt > Date.now()) {
      earliest = Math.min(earliest, candidate.availableAt);
      previous ??= candidate.id;
      continue;
    }
    if (previous)
      yield {
        type: "switch",
        from: previous,
        to: candidate.id,
        replaceDraft: hasDraft,
        ...(quota ? { quota: true as const } : {}),
      };
    hasDraft = false;
    const signal = AbortSignal.any([
      options.signal,
      AbortSignal.timeout(options.timeoutMs),
    ]);
    try {
      for await (const chunk of candidate.adapter.stream(history, signal)) {
        hasDraft ||= Boolean(chunk.text);
        yield { type: "chunk", provider: candidate.id, chunk };
      }
      yield { type: "done", provider: candidate.id, model: candidate.model };
      return;
    } catch (error) {
      options.signal.throwIfAborted();
      const failure = candidate.adapter.normalizeError(error);
      if (!failure.retryable) throw failure;
      const until =
        failure.resetAt && failure.resetAt > Date.now()
          ? failure.resetAt
          : Date.now() + 60_000;
      await options.cooldown(candidate.id, until);
      earliest = Math.min(earliest, until);
      quota = failure.message === "Provider quota reached";
      previous = candidate.id;
    }
  }
  yield {
    type: "exhausted",
    resetAt: Number.isFinite(earliest) ? earliest : undefined,
  };
}
