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

async function callGemini(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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

function getAvailableProvider(): LLMProvider | null {
  if (config.geminiApiKey) return 'gemini';
  if (config.ollamaBaseUrl && ollamaAvailable) return 'ollama';
  return null;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  preferredProvider?: LLMProvider,
): Promise<LLMResponse> {
  const provider = preferredProvider || getAvailableProvider();

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

export async function ensureProviderReady(): Promise<void> {
  if (config.geminiApiKey) return;
  if (config.ollamaBaseUrl) await checkOllamaAvailability();
}

export function isConfigured(): boolean {
  return getAvailableProvider() !== null;
}

export function getActiveProvider(): string {
  return getAvailableProvider() || 'none';
}
