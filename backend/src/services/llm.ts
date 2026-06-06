import { config } from '../lib/config.js';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: TokenUsage;
}

let sessionTokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

export function getSessionTokenUsage(): TokenUsage {
  return { ...sessionTokenUsage };
}

export function resetSessionTokenUsage(): void {
  sessionTokenUsage = { inputTokens: 0, outputTokens: 0 };
}

function addUsage(usage: TokenUsage) {
  sessionTokenUsage.inputTokens += usage.inputTokens;
  sessionTokenUsage.outputTokens += usage.outputTokens;
}

// --- Gemini Provider ---

// [Fix #3] Memoize the dynamic import and client instance to avoid re-importing and
// re-constructing on every call.
let _geminiClient: InstanceType<
  Awaited<typeof import('@google/generative-ai')>['GoogleGenerativeAI']
> | null = null;

async function getGeminiClient() {
  if (!_geminiClient) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    _geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return _geminiClient;
}

const GEMINI_TIMEOUT_MS = 60_000;

async function callGemini(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  // Pass AbortSignal.timeout so the SDK can abort the in-flight HTTP request when the
  // deadline expires (SingleRequestOptions.signal is supported by this SDK version).
  const result = await model.generateContent(userMessage, {
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  const response = result.response;
  const text = response.text();
  const usage: TokenUsage = {
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
  };

  addUsage(usage);
  return { text, usage };
}

// --- Ollama Provider ---

async function callOllama(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  // [Fix #1] Add AbortSignal timeout so a hung Ollama call does not block collection indefinitely.
  const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt: userMessage,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 4096,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as {
    response: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };

  const usage: TokenUsage = {
    inputTokens: data.prompt_eval_count || 0,
    outputTokens: data.eval_count || 0,
  };

  addUsage(usage);
  return { text: data.response, usage };
}

// --- Retry Logic ---

// [Fix #1] Classify an error as transient (network failure, HTTP 429 rate-limit, or HTTP 5xx).
// Non-transient errors (4xx auth/validation, timeout, abort) are rethrown immediately.
function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // fetch() network-level failures (e.g. ECONNREFUSED, ENOTFOUND)
    return true;
  }
  // Catch SDK-wrapped abort/timeout errors that are plain Error instances, not DOMException.
  // The @google/generative-ai SDK re-wraps native AbortError as GoogleGenerativeAIAbortError
  // (extends Error, not DOMException), so the DOMException checks below would miss it and
  // fall through to the default `return true`, causing up to 3 retries on a timeout.
  if (
    error instanceof Error &&
    (error.name === 'GoogleGenerativeAIAbortError' ||
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /\baborted\b/i.test(error.message))
  ) {
    return false;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    // AbortSignal.timeout fired — not worth retrying
    return false;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  if (error instanceof Error) {
    const msg = error.message;
    // HTTP status embedded in error message (Ollama, Gemini timeout wrapper)
    const statusMatch = msg.match(/\b(\d{3})\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      if (status === 429) return true;   // rate-limit
      if (status >= 500) return true;    // server error
      if (status >= 400) return false;   // auth / bad-request — do not retry
    }
  }
  // Default: treat unknown errors as potentially transient
  return true;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // [Fix #1] Rethrow non-transient errors immediately without retry.
      if (!isTransientError(error)) throw error;
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`  Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

// --- Public API ---

export type LLMProvider = 'gemini' | 'ollama';

let ollamaVerified = false;
let ollamaAvailable = false;

// Single source of truth for the resolved provider.
// Set by resolveProvider() / ensureProviderReady() and read by
// isConfigured() / getActiveProvider() so all paths agree.
let _cachedProvider: LLMProvider | null | undefined = undefined; // undefined = not yet resolved

async function checkOllamaAvailability(): Promise<boolean> {
  if (ollamaVerified) return ollamaAvailable;
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
  ollamaVerified = true;
  return ollamaAvailable;
}

async function resolveProvider(): Promise<LLMProvider | null> {
  if (_cachedProvider !== undefined) return _cachedProvider;
  if (config.geminiApiKey) {
    _cachedProvider = 'gemini';
    return _cachedProvider;
  }
  if (config.ollamaBaseUrl) {
    const available = await checkOllamaAvailability();
    _cachedProvider = available ? 'ollama' : null;
    return _cachedProvider;
  }
  _cachedProvider = null;
  return _cachedProvider;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  preferredProvider?: LLMProvider,
): Promise<LLMResponse> {
  const provider = preferredProvider || await resolveProvider();

  if (!provider) {
    throw new Error('No LLM provider configured. Set GEMINI_API_KEY or OLLAMA_BASE_URL.');
  }

  console.log(`  [LLM] Using provider: ${provider}`);

  return withRetry(async () => {
    if (provider === 'gemini') {
      return callGemini(systemPrompt, userMessage);
    } else {
      return callOllama(systemPrompt, userMessage);
    }
  });
}

// ensureProviderReady must be called once at startup (e.g. from collector.ts) before
// isConfigured() / getActiveProvider() are used, so the cached provider is populated.
export async function ensureProviderReady(): Promise<void> {
  await resolveProvider();
}

// isConfigured / getActiveProvider are synchronous helpers used after ensureProviderReady().
// They read _cachedProvider which is set by resolveProvider()/ensureProviderReady().
// Do not call them before ensureProviderReady() has resolved.
export function isConfigured(): boolean {
  return _cachedProvider !== null && _cachedProvider !== undefined;
}

export function getActiveProvider(): string {
  return _cachedProvider ?? 'none';
}
