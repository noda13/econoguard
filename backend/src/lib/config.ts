import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const schema = z.object({
  PORT: z.string().optional().default('8901'),
  NODE_ENV: z.string().optional().default('development'),
  // LLM providers
  GEMINI_API_KEY: z.string().optional().default(''),
  OLLAMA_BASE_URL: z.string().optional().default('http://host.docker.internal:11434'),
  OLLAMA_MODEL: z.string().optional().default('qwen2.5:7b'),
  // Data sources
  NEWSAPI_KEY: z.string().optional().default(''),
  FRED_API_KEY: z.string().optional().default(''),
  OPENEXCHANGERATES_APP_ID: z.string().optional().default(''),
  // Database — required (Prisma also reads this directly, but we surface it for validation)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Auth — required in production
  ADMIN_SECRET: isProduction
    ? z.string().min(1, 'ADMIN_SECRET is required in production')
    : z.string().optional().default(''),
  // CORS — required in production; comma-separated list of allowed origins
  ALLOWED_ORIGINS: isProduction
    ? z.string().min(1, 'ALLOWED_ORIGINS is required in production')
    : z.string().optional().default(''),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = result.data;

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  // LLM providers
  geminiApiKey: env.GEMINI_API_KEY,
  ollamaBaseUrl: env.OLLAMA_BASE_URL,
  ollamaModel: env.OLLAMA_MODEL,
  // Data sources
  newsApiKey: env.NEWSAPI_KEY,
  fredApiKey: env.FRED_API_KEY,
  openExchangeRatesAppId: env.OPENEXCHANGERATES_APP_ID,
  // Database
  databaseUrl: env.DATABASE_URL,
  // Auth
  adminSecret: env.ADMIN_SECRET,
  // CORS — parsed into a string[] for direct use in cors() origin checks
  allowedOrigins: env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [] as string[],
};
