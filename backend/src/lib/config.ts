import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8901', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // LLM providers
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
  // Legacy (keep for future Claude support)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Data sources
  newsApiKey: process.env.NEWSAPI_KEY || '',
  fredApiKey: process.env.FRED_API_KEY || '',
  openExchangeRatesAppId: process.env.OPENEXCHANGERATES_APP_ID || '',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
};
