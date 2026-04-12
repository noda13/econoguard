import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }
  return client;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

let sessionTokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

export function getSessionTokenUsage(): TokenUsage {
  return { ...sessionTokenUsage };
}

export function resetSessionTokenUsage(): void {
  sessionTokenUsage = { inputTokens: 0, outputTokens: 0 };
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError ||
        (error instanceof Anthropic.APIConnectionError);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function callHaiku(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; usage: TokenUsage }> {
  const anthropic = getClient();

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })
  );

  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
  sessionTokenUsage.inputTokens += usage.inputTokens;
  sessionTokenUsage.outputTokens += usage.outputTokens;

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return { text, usage };
}

export async function callSonnetWithTools<T>(
  systemPrompt: string,
  userMessage: string,
  tools: Anthropic.Tool[],
): Promise<{ result: T; usage: TokenUsage }> {
  const anthropic = getClient();

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
      tools,
      tool_choice: { type: 'any' },
    })
  );

  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
  sessionTokenUsage.inputTokens += usage.inputTokens;
  sessionTokenUsage.outputTokens += usage.outputTokens;

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUseBlock) {
    throw new Error('No tool_use block in response');
  }

  return { result: toolUseBlock.input as T, usage };
}

export function isConfigured(): boolean {
  return !!config.anthropicApiKey;
}
